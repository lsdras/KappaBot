import String from "../extension/stringExtension";
import CommandRepository from "../procedure/commandRepository";
import Global from "../core/global";
import { IBehavior } from "./IBehavior";
import * as Command from "../../json/command.json";
import * as SystemMessage from "../../json/systemMessage.json";

export class AddLine implements IBehavior
{
    args: string[];
    channelId: string;
    isSystemCommand: boolean;

    constructor(args: string, channelId: string)
    {
        this.args = String.Slice([args], /\s|\n/, Command.추가.ArgCount-1);
        this.channelId = channelId;
    }

    public async Run()
    {
        var result = await this.GetResult();

        Global.Client.SendMessage(this.channelId, result);
    }

    async GetResult(): Promise<string>
    {
        var hasValues = String.HasValue(this.args, Command.추가.ArgCount);
        if (!hasValues)
        {
            return CommandRepository.DefaultHelpString();
        }

        if (CommandRepository.IsSystemCommand(this.args[0]))
        {
            return SystemMessage.IsSystemMessage;
        }

        await CommandRepository.AddLine(this.channelId, this.args[0], this.args[1]);

        return SystemMessage.Comfirmed;
    }
}
