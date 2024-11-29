use anyhow::Context;
use fxhash::FxHashMap;
use image::{save_buffer, ExtendedColorType, ImageBuffer, LumaA, Pixel, RgbaImage};
use psd::Psd;
use rayon::iter::{
    IntoParallelIterator, IntoParallelRefIterator, ParallelIterator,
};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone, Copy)]
struct LevelInfo {
    character_half_width: u32,
    character_half_height: u32,
}

fn main() -> anyhow::Result<()> {
    let working_dir = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "static/levels".to_string());
    std::env::set_current_dir(working_dir)?;

    let level_infos: FxHashMap<String, LevelInfo> = toml::from_str(
        std::fs::read_to_string("levels.toml")
            .context("Reading levels.toml")?
            .as_str(),
    )?;

    let psds: Vec<_> = std::fs::read_dir(".")?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().map_or(false, |ext| ext == "psd"))
        .map(|entry| entry.path())
        .collect();

    psds.into_par_iter().for_each(|psd_path| {
        let bytes = match std::fs::read(&psd_path) {
            Ok(bytes) => bytes,
            Err(err) => {
                eprintln!("Error reading {:?}: {}", psd_path, err);
                return;
            }
        };
        let psd = match Psd::from_bytes(&bytes) {
            Ok(psd) => psd,
            Err(err) => {
                eprintln!("Error parsing {:?}: {}", psd_path, err);
                return;
            }
        };
        drop(bytes);

        let mut folder_path = psd_path.clone();
        folder_path.set_extension("");
        let level_name = folder_path.file_name().unwrap().to_str().unwrap();
        let Some(level_info) = level_infos.get(level_name) else {
            eprintln!("No level info for {:?}", level_name);
            return;
        };

        match std::fs::create_dir_all(&folder_path) {
            Ok(()) => (),
            Err(err) => {
                eprintln!("Error creating folder {:?}: {}", folder_path, err);
                return;
            }
        }
        let Some(background_group_id) = psd.group_ids_in_order().get(2) else {
            eprintln!("No background in {:?}", psd_path);
            return;
        };

        rayon::join(
            || {
                let layers: Vec<_> = psd.get_group_sub_layers(background_group_id)
                    .unwrap()
                    .par_iter()
                    // There is a bug where the visibility is inverted
                    .filter(|layer| !layer.visible())
                    .map(|layer| {
                        RgbaImage::from_raw(psd.width(), psd.height(), layer.rgba()).unwrap()
                    })
                    .collect();
                let mut compiled = RgbaImage::new(psd.width(), psd.height());

                compiled
                    .par_enumerate_pixels_mut()
                    .for_each(|(x, y, pixel)| {
                        let mut layer_iter = layers.iter();
                        let Some(layer) = layer_iter.next() else { return; };
                        *pixel = *layer.get_pixel(x, y);
                        if pixel[3] == 255 {
                            return;
                        }

                        for layer in layer_iter {
                            let layer_pixel = layer.get_pixel(x, y);
                            if layer_pixel[3] == 0 {
                                continue;
                            }
                            let mut tmp = *layer_pixel;
                            tmp.blend(pixel);
                            *pixel = tmp;
                            if pixel[3] == 255 {
                                break;
                            }
                        }
                    });

                match save_buffer(
                    folder_path.join("background.webp"),
                    &compiled,
                    psd.width(),
                    psd.height(),
                    ExtendedColorType::Rgba8,
                ) {
                    Ok(()) => (),
                    Err(err) => eprintln!("Error saving background.webp: {}", err),
                }
            },
            || {
                let walls_group_id = &psd.group_ids_in_order()[0];
                let mut layers: Vec<_> = psd.get_group_sub_layers(walls_group_id)
                    .unwrap()
                    .par_iter()
                    .filter(|layer| !layer.visible())
                    .map(|layer| {
                        RgbaImage::from_raw(psd.width(), psd.height(), layer.rgba()).unwrap()
                    })
                    .collect();
                let mut compiled = ImageBuffer::<LumaA<u8>, _>::new(psd.width(), psd.height());

                compiled
                    .par_enumerate_pixels_mut()
                    .for_each(|(x, y, pixel)| {
                        for layer in layers.iter() {
                            for ly in (y.saturating_sub(level_info.character_half_height))
                                ..y.saturating_add(level_info.character_half_height)
                            {
                                if layer.get_pixel_checked(0, ly).is_none() {
                                    break;
                                }
                                for lx in (x.saturating_sub(level_info.character_half_width))
                                    ..x.saturating_add(level_info.character_half_width)
                                {
                                    let Some(layer_pixel) = layer.get_pixel_checked(lx, ly) else {
                                        break;
                                    };
                                    if layer_pixel[3] == 0 {
                                        continue;
                                    }
                                    *pixel = LumaA([0, 255]);
                                    return;
                                }
                            }
                        }
                    });
                macro_rules! save {
                    () => {
                        match save_buffer(
                            folder_path.join("collisions.webp"),
                            &compiled,
                            psd.width(),
                            psd.height(),
                            ExtendedColorType::La8,
                        ) {
                            Ok(()) => (),
                            Err(err) => eprintln!("Error saving collisions.webp: {}", err),
                        }
                    };
                }
                let area_group_id = &psd.group_ids_in_order()[1];

                layers = psd.get_group_sub_layers(area_group_id)
                    .unwrap()
                    .par_iter()
                    .filter(|layer| layer.visible())
                    .map(|layer| {
                        RgbaImage::from_raw(psd.width(), psd.height(), layer.rgba()).unwrap()
                    })
                    .collect();

                if layers.len() > u8::MAX as usize - 1 {
                    eprintln!(
                        "Too many layers in area group {:?} ({} > {})",
                        psd_path,
                        layers.len(),
                        u8::MAX
                    );
                    return;
                }

                compiled
                    .par_enumerate_pixels_mut()
                    .for_each(|(x, y, pixel)| {
                        if pixel[1] != 0 {
                            return;
                        }
                        for (i, layer) in layers.iter().enumerate().rev() {
                            let layer_pixel = layer.get_pixel(x, y);
                            if layer_pixel[3] == 0 {
                                continue;
                            }
                            let i = i as u8 + 1;
                            *pixel = LumaA([i, 255]);
                            break;
                        }
                    });

                save!();
            },
        );
    });

    eprintln!("Done!");
    Ok(())
}
