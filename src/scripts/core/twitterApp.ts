import * as Twitter from "twitter";
import * as Secret from "../../json/secret.json";
import Global from "./global.js";
import Dictionary from "../collection/dictionary.js";
import { stringify } from "querystring";

export default class TwitterApplication
{
    private client: Twitter

    constructor()
    {
        this.client = new Twitter({
            consumer_key: Secret.CounsumerKey,
            consumer_secret: Secret.ConsumerSecret,
            access_token_key: Secret.AccessToken,
            access_token_secret: Secret.AccessTokenSecret 
        });
    }

    public async Initialize()
    {
        var userIds = new Array<string>()
        var userIdToChannelIdMap = new Dictionary<string, string>();

        for (var data of Secret.TwitterUsersUnderWatching)
        {
            var userId = await this.GetUserId(data.UserName);
            userIds.push(userId);

            userIdToChannelIdMap.Add(userId, data.BroadcastChannelId);
        }

        if (userIds.length != 0)
        {
            this.WatchTimeline(userIds, userIdToChannelIdMap);
        }
    }

    private async GetUserId(userName: string): Promise<string>
    {
        var userData = await this.client.get("users/show", {screen_name: userName});
        return userData.id_str;
    }

    private async WatchTimeline(userIds: Array<string>, userIdToChannelIdMap: Dictionary<string, string>)
    {
        var userIdsStr = userIds.toString();

        var stream = this.client.stream("statuses/filter", {follow: userIdsStr});
        stream.on("data", async (event) =>
        {
            var message = "https://twitter.com/" + event.user.screen_name + "/status/" + event.id_str;
            var eventUserId = event.user.id_str;
            var isRT = event.text.startsWith("RT @");
            
            // 알티인 경우도 걸리지만 그런 경우는 트윗하지 않기로
            if (!isRT && userIdToChannelIdMap.ContainsKey(eventUserId))
            {
                var targetChannelId = userIdToChannelIdMap.MustGet(eventUserId);
                await Global.Client.SendMessage(targetChannelId, message);
            }
        });
    }
}