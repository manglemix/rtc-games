import { DEFAULT_MODEL, generateContextless, listModels, pullModel } from "$lib/ollama";
import type { NetworkPeer } from "$lib/rtc";
import { State, type GameState } from "./game-state.svelte";

export abstract class AiAssistant {
	public onAIResponsePart: (part?: string) => void = () => {};
    
    protected systemMessage(): string {
        let msg = `
You are an assistant that gives brief answers to the players of the game called Hantu. It is a social deduction game where players must work together
to find the possessed players and fix the crypt. The game is played in rounds, with each round consisting of a key proposition, a key vote, a day phase, and a night phase.
The game ends when all possessed players are dead or the only players left are possessed.

During the key proposition, a player proposes a list of players who they believe should hold a key. The key allows the holder to enter the crypt and repair it. If a repair
fails, the crypt may be damaged. This can be taken advantage of by the possessed. The key vote is where all players get to agree or disagree with the proposition. If the
majority disagrees, the next player clockwise will propose a new list. If the majority agrees, the players on the list will hold the key for the day phase. If it goes down
to the last player to propose a list, there is no vote and the list is automatically accepted.

Throughout the day and night, non-possessed players must stay awake. If they pass out, they will be not be able to move for a few seconds. If they pass out 3 times, they die.
There are several chores players can do to stay awake, on top of repairing the crypt if they hold the key. If a player messes up a chore, that chore will need to be fixed before
it can be done again. This can also be taken advantage of by the possessed. The only activity players can't do is sleep or rest.

A key holder is also able to lock up a nearby player for a few minutes. Only one player can be locked up at one time, and the timer can be reset by a key holder without releasing
the player. When it is time for key propositions, the player will be released automatically.

From the 3rd night onwards, if a possessed player attempts to sleep in their bedroom, they will be able to turn into a ghost and kill a non-possessed player. At the same time,
non-possessed players are allowed to vote to execute a jailed person. This is done by walking up to the jail and voting yes (you vote no by refusing to vote). If the majority votes
yes before the player is released, that player dies.

If 5 nights have passed, the non-possessed automatically lose. If the crypt is fixed, everyone votes on who they think is possessed. The top ${this.gameState.initialPossessedCount} most-voted
players are killed where ${this.gameState.initialPossessedCount} is the number of possessed at the start of the game. If all possessed players are dead, the non-possessed win, and vice-versa.
Dead players can only spectate.

The current player you are helping is named "${this.gameState.thisPlayer.name}", is ${this.gameState.thisPlayer.possessed ? 'possessed' : 'not possessed'}, and is ${this.gameState.thisPlayer.alive ? 'alive' : 'not alive'}.
`;

        const otherPlayers = Array.from(this.gameState.players.values().filter((player) => player.name !== this.gameState.thisPlayer.name));
        if (this.gameState.thisPlayer.possessed) {
            if (this.gameState.initialPossessedCount > 1) {
                msg += "The other possessed players are: " + otherPlayers.filter((player) => player.possessed).map((player) => player.name).join(', ') + ".\n";
            } else {
                msg += "There are no other possessed players.\n";
            }
            msg += "The non-possessed players are: " + otherPlayers.filter((player) => !player.possessed).map((player) => player.name).join(', ') + ".\n";
        } else if (this.gameState.players.size > 1) {
            msg += "The other players are: " + otherPlayers.map((player) => player.name).join(', ') + ".\n";
        }

        const proposals = Array.from(this.gameState.proposals).map((name) => {
            if (name === this.gameState.thisPlayer.name) {
                return 'the player';
            } else {
                return name;
            }
        }).join(', ');
        switch (this.gameState.state) {
            case State.KeyProposition:
                msg += `It is currently the key proposition phase. ${this.gameState.proposer.name} is the proposer. ${this.gameState.proposals.size > 0 ? `The current proposed key holders are: ${proposals}` : 'They have not proposed anyone yet'}.\n`;
                break;
            case State.KeyVote:
                msg += `It is currently the key vote phase. The key holders are: ${proposals}.\n`;
                break;
            case State.KeyVoteResults:
                msg += `The key vote results are in. The key holders are: ${proposals}.\n`;
                break;
            case State.Day:
                msg += `It is currently the day phase. The key holders are: ${proposals}.\n`;
                break;
            case State.Night:
                msg += `It is currently the night phase. The key holders are: ${proposals}.\n`;
                break;
            case State.FinalVote:
                msg += `It is currently the final vote phase.\n`;
                break;
            case State.EndResults:
                msg += `The game has ended and the lobby will be closed shortly.\n`;
                break;
        }

        msg += `Feel free to explain any of the given information to the player. If a player asks you a question that cannot be answered with the information given, refuse to answer the question and
explain that your knowledge is limited to this game. Do not use text formatting. Ensure that your answers are correct. You cannot execute actions on the player's behalf. You simply inform the player.`;

        return msg;
    }
    
    public static create(gameState: GameState, netClient: NetworkPeer): AiAssistant {
        if (netClient.isHost) {
            return new HostAiAssistant(gameState, netClient);
        } else {
            return new GuestAiAssistant(gameState, netClient);
        }
    }

    protected constructor(private gameState: GameState) {}

    public abstract askAI(prompt: string): void;
}


class GuestAiAssistant extends AiAssistant {
    constructor(gameState: GameState, private netClient: NetworkPeer) {
        super(gameState);
		
		netClient.addOnMessage('ollama', (from, msg) => {
			this.onAIResponsePart(JSON.parse(msg.data).part);
		});
    }
    

	public askAI(prompt: string): void {
		this.netClient.sendTo(this.netClient.hostName, prompt, 'ollama');
	}
}

class HostAiAssistant extends AiAssistant {
	private ollamaInitialized = false;

    constructor(gameState: GameState, private netClient: NetworkPeer) {
        super(gameState);

        listModels().then(
            async (models) => {
                if (!models.includes(DEFAULT_MODEL)) {
                    console.log("Pulling AI model");
                    const status = await pullModel();
                    if (status !== 'success') {
                        console.error('Failed to pull model: ' + status);
                        return;
                    }
                }
                this.ollamaInitialized = true;
            },
        );
		
        netClient.addOnMessage('ollama', (from, msg) => {
            if (!this.ollamaInitialized) {
                console.error('Ollama not initialized');
                this.netClient.sendTo(from, JSON.stringify({ part: "I'm sorry, the host does not seem to have ollama set up." }), 'ollama');
                this.netClient.sendTo(from, JSON.stringify({  }), 'ollama');
                return;
            }
            generateContextless(
                msg.data,
                (part) => {
                    this.netClient.sendTo(from, JSON.stringify({ part }), 'ollama');
                },
                this.systemMessage(),
            );
        });
    }
    
    public askAI(prompt: string): void {
        generateContextless(
            "Player: " + prompt,
            (part) => this.onAIResponsePart(part),
            this.systemMessage(),
        ).then(undefined, () => {
            this.onAIResponsePart("Model is not initialized. You must install ollama first.");
            this.onAIResponsePart(undefined);
        });
    }
}