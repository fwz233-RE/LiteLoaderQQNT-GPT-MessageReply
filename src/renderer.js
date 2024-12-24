import { Group, PlainText, MessageChain,EventChannel } from '../LiteLoaderQQNT-Euphony/src/index.js';
//需要LiteLoaderQQNT-Euphony这个项目实现,https://github.com/xtaw/LiteLoaderQQNT-Euphony,把它下载解压然后改名放在根目录即可
var group = Group.make(随便一个群号);
//group.sendMessage(new MessageChain().append(new PlainText('机器人,')).append(new PlainText('启动!')));
const eventChannel = EventChannel.withTriggers();
eventChannel.subscribeEvent('receive-message', async (message, source) => {
    console.log(message.contentToString());
    console.log(source.getContact().getId());

    if (message.contentToString().includes('唤醒词')) {
      const group = Group.make(source.getContact().getId());
      group.sendMessage(new PlainText('在'));
      var question = message.contentToString().replaceAll('唤醒词', "");

      const fetchData = async () => {
        try {
          const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer 你的密钥",
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: "您是一个有帮助的助手。" },
                { role: "user", content: question },
              ],
              stream: false,
            }),
          });
      
    // 这里的 response 是一个响应对象，需要先进行 .json() 解析
    const data = await response.json(); 
    const content = data.choices[0].message.content;
    // 假设 group.sendMessage() 是你的发送消息逻辑
    group.sendMessage(new PlainText(content));

        } catch (error) {
          console.error("请求出现错误：", error);

        }
      };
      
      // 调用函数执行请求
      fetchData();
      
      
     
    }
});
