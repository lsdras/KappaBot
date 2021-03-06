import Global from "./global";
import Log from "./log";
import Math from "../extension/mathExtension";
import String from "../extension/stringExtension";
import BackgroundJob from "./backgroundJob";
import BehaviorFactory from "../behavior/behaviorFactory";
import { Message, TextChannel } from "discord.js";
import { User } from "discord.js";
import { CommandNotFoundError, InvaildUsageError  } from "./assert";
import * as Playing from "../../json/playing.json";
import * as Config from "../../json/config.json";
import * as Command from "../../json/command.json";
import * as Secret from "../../json/secret.json";
import BlacklistRepository from "../procedure/blacklistRepository";

export default class Application
{
    // 실제 사용자용 로직이 들어가는 클래스
    // Global 초기화 이후 불리므로 Global 쓸 수 있음
    // 상태도 가질 수 있다

    private currentActivityIndex: number = 0
    private activityList: Array<string>

    public Initialize()
    {
        // 그냥 this.OnMessage를 넘기면 함수 내부의 this 참조가 고장난다
        // 그래서 람다로 한 번 더 감싸서 보내줘야 함...
        Global.System.AddMessageListener((msg) =>  this.OnChannelMessage(msg));
        Global.System.AddMessageListener((msg) =>  this.OnDirectMessage(msg));
        Global.System.AddExitHook(() => this.OnApplicationEnd());
        this.InitializeActivity();

        Log.Info("Application Initialized");
    }

    public async Update(): Promise<void>
    {
        // do nothing
    }

    OnApplicationEnd(): void
    {
        var notify = "프로그램이 종료되었습니다.";

        Global.Client.SendDirectMessage(Secret.AdminId, notify);
    }

    InitializeActivity()
    {
        this.activityList = new Array<string>();
        Playing.Message.forEach((elem: string) => { this.activityList.push(elem); });
        this.currentActivityIndex = Math.Range(0, this.activityList.length - 1);

        BackgroundJob.Run(async () =>
        {
            await this.SetNextActivitymessage();
        }, BackgroundJob.HourInterval);
    }

    async SetNextActivitymessage()
    {
        // 명령어 호출용 prefix를 달아서 호출 방법을 안내하게 하는 목적
        var currentActivity = Config.Prefix + this.activityList[this.currentActivityIndex];
        await Global.Client.SetActivity(currentActivity);
        this.currentActivityIndex = (this.currentActivityIndex + 1) % this.activityList.length;
    }

    async OnDirectMessage(message: Message)
    {
        // 임시기능
        if (message.channel.type == "dm" && message.author.id == Secret.AdminId)
        {
            Global.System.TerminalCommand(message.content, "명령어가 실패했습니다.");
        }
    }

    async OnChannelMessage(message: Message)
    {
        if (message.channel.type == "text")
        {
            var content = message.content;
            var channelId = message.channel.id;

            var attachments = message.attachments.array();
            if (attachments.length != 0)
            {
                content = content + " " + attachments[0].url;
            }

            await this.HandleMessage(content, channelId, message.author);
        }
    }

    async HandleMessage(message: string, channelId: string, author: User)
    {
        if (await BlacklistRepository.IsBlackList(author.id))
        {
            return;
        }

        if (message.startsWith(Config.Prefix) && !author.bot)
        {
            // $만 입력한 경우
            if (message.length == 1) 
            {
                message = "$도움말";
            }

            var prefixRemoved = message.slice(Config.Prefix.length);
            var args = String.Slice([prefixRemoved], /\s|\n/, 1);
            var command = args[0];
            var others = args[1];

            try
            {
                // behavior가 직접 채널에 메세지를 쏘는 구조로 되어있다
                // 메세지를 리턴받아서 처리하는 방안을 고려해봤지만
                // Behavior 안에서 코드 시나리오가 완결되는 형태가 더 좋아보여서 이렇게 함
                // 이렇게 해보니까 결과값을 DM으로 보내기도 편한듯
                var behavior = BehaviorFactory.Create(command, others, author.id, channelId);
                
                var promise = await behavior.Run();
                promise
            }
            catch (error)
            {
                this.HandleError(error, message, channelId);
            }
        }
    }

    async HandleError(error: any, message: string,  channelId: string)
    {
        if (error instanceof InvaildUsageError)
        {
            var messageInvaildUsageError = error as InvaildUsageError;
            var key = messageInvaildUsageError.Key;

            await Global.Client.SendMessage(channelId, this.GetUsageHelp(key));
        }
        else if (error instanceof CommandNotFoundError)
        {   
            var msg = "명령어를 찾지 못했습니다. '" + Config.Prefix + "도움말'을 입력해보세요.";

            await Global.Client.SendMessage(channelId, msg);
        }
        else
        {
            var channelTag = "<#" + channelId + ">";
            var msg =  channelTag + "에서 에러가 발생했습니다.\n메세지: " + message + "\n```" + error.stack + "```";

            await Global.Client.SendDirectMessage(Secret.AdminId, msg);
        }
    }

    GetDefaultHelp(): string
    {
        var content = "기본 명령어\n";
        var commands = Command as any;
        for (var key in Command)
        {
            if (commands[key].IsAdminCommand) { continue; }
            content = content + Config.Prefix + commands[key].Usage + "\n";
        }
        return content;
    }

    GetUsageHelp(key: string): string
    {
        var commands = Command as any;
        var command = commands[key];
        return key + " 명령어의 사용법입니다.\n" +  Config.Prefix + command.Usage;
    }
}