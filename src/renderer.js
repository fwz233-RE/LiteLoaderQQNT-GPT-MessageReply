
//需要LiteLoaderQQNT-Euphony这个项目实现,https://github.com/xtaw/LiteLoaderQQNT-Euphony,把它下载解压然后改名放在根目录即可

import {
  Group,
  PlainText,
  MessageChain,
  EventChannel
} from '../LiteLoaderQQNT-Euphony/src/index.js';

const eventChannel = EventChannel.withTriggers();

// 用于保存每个联系人的会话记录 { contactId: [ {role: "...", content: "..."}, ... ] }
const conversationMemory = {};

eventChannel.subscribeEvent('receive-message', async (message, source) => {
  const contactId = source.getContact().getId();  // 每个 contactId 对应一份独立记忆
  console.log(message.contentToString());
  console.log(contactId);

  // 如果没有为当前 contactId 初始化记忆，则先创建一个带有 system 提示的数组
  if (!conversationMemory[contactId]) {
    conversationMemory[contactId] = [
      { role: "system", content: "您是一个有帮助的助手。" }
    ];
  }

  // ===== 新增逻辑：识别到 "傻逼fwz" 清除所有记忆并回复 "已经清除" =====
  if (message.contentToString().includes('傻逼fwz')) {
    // 重新初始化对话数组
    conversationMemory[contactId] = [
      { role: "system", content: "您是一个有帮助的助手。" }
    ];

    // 给群发一条提示消息：已经清除
    const group = Group.make(contactId);
    group.sendMessage(new PlainText('已经所有记忆清除'));

    // 不再往下执行赛博fwz逻辑，直接 return
    return;
  }

  
  // ====================================================================


   // ===== 新增：搜索fwz 逻辑 =====
   if (message.contentToString().includes('搜索fwz')) {
    const group = Group.make(contactId);

    // 1. 提取出关键词，这里假设“搜索fwz”后面的内容就是关键词
    // 例如用户输入 "搜索fwz 奥林匹克运动会"，则取出 "奥林匹克运动会" 作为关键词
    const keyword = message.contentToString()
      .replaceAll('搜索fwz', '')
      .trim();

    if (!keyword) {
      group.sendMessage(new PlainText('未检测到搜索关键词，请在"搜索fwz"后输入关键词。'));
      return;
    }

    // 告知用户已经开始处理
    group.sendMessage(new PlainText(`正在搜索：${keyword} ...`));


    try {
      // 2. 访问百度百科页面（HTML）
      const baikeResponse = await fetch(`https://baike.baidu.com/item/${encodeURIComponent(keyword)}`);
      const baikeHtml = await baikeResponse.text();
          // 去除除中文字符以外的所有字符
      const chineseOnly = baikeHtml.replace(/[^\p{Script=Han}]/gu, '');

      // 3. 调用深度搜索 / OpenAI / 其他 AI 接口来总结提炼
      // 这里以 deepseek 接口为例，示范性地让它“从 HTML 中提取主要中文百科内容并总结成三句话”。
      const summarizeResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 这里的 token 仅为示例，请自行替换
          "Authorization": "Bearer sk-233",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "你是一个帮助用户提炼中文百科内容的助手。" },
            {
              role: "user",
              content: `
请从以下百度百科的HTML页面内容中提取出与【${keyword}】相关的最主要中文描述：
${chineseOnly}
`
            }
          ],
          stream: false,
        }),
      });
      const data = await summarizeResponse.json();
      const content = data.choices[0].message.content ?? "抱歉，被玩坏了。";

      // 4. 发送回用户
      group.sendMessage(new PlainText(content));
    } catch (err) {
     // console.error("搜索fwz逻辑中出现错误：", err);
      group.sendMessage(new PlainText("抱歉，获取或提炼百科内容时被玩坏了。"));
    }

    // 这里搜索逻辑结束后直接 return，不再进入下面的 赛博fwz 流程
    return;
  }
  // ===== 搜索fwz 逻辑结束 =====


  // ====================================================================

  if (message.contentToString().includes('赛博fwz')) {
    // 先给群发一条提示消息
    const group = Group.make(contactId);
    group.sendMessage(new PlainText('在'));

    // 将“赛博fwz”替换掉，只保留用户的真实问题
    const question = message.contentToString().replaceAll('赛博fwz', '');

    // 把用户的问题存入会话数组
    conversationMemory[contactId].push({
      role: 'user',
      content: '之前的当做新回复的参考,接下来才是主要内容:回答的长度不超过三句话, ' + question
    });

    // 如果超过 50 条，则移除最早的一条
    if (conversationMemory[contactId].length > 50) {
      conversationMemory[contactId].shift();
    }

    // 发起请求并带上当前的对话数组
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-233",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: conversationMemory[contactId],  // 这里带上所有对话上下文
          stream: false,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content ?? "抱歉，我暂时无法回答。";

      // 把 AI 回复也存入会话数组
      conversationMemory[contactId].push({
        role: 'assistant',
        content: content
      });

      // 同样做一下 50 条截断
      if (conversationMemory[contactId].length > 50) {
        conversationMemory[contactId].shift();
      }

      // 发送 AI 回复到群
      group.sendMessage(new PlainText(content));

    } catch (error) {
      console.error("请求出现错误：", error);
    }
  }
});
