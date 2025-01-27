
//需要LiteLoaderQQNT-Euphony这个项目实现,https://github.com/xtaw/LiteLoaderQQNT-Euphony,把它下载解压然后改名放在根目录即可
import {
  Group,
  PlainText,
  MessageChain,
  EventChannel,
  Member
} from '../LiteLoaderQQNT-Euphony/src/index.js';

const eventChannel = EventChannel.withTriggers();

//祥子的记忆
const dialogueMemory = []; 

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
          "Authorization": "Bearer apikey",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "你是一个帮助用户提炼中文百科内容的助手。" },
            {
              role: "user",
              content: `
请从以下百度百科的HTML页面内容中提取出与【${keyword}】相关的最主要中文描述：
${chineseOnly}.如果界面不存在则回复:呜呜呜，被玩坏了，换一个简短的关键词吧。
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

    // 如果超过 5 条，则移除最早的一条
    if (conversationMemory[contactId].length > 5) {
      conversationMemory[contactId].shift();
    }

    // 发起请求并带上当前的对话数组
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer apikey",
        },
        body: JSON.stringify({
          model: "deepseek-reasoner",
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

      // 同样做一下 5 条截断
      if (conversationMemory[contactId].length > 5) {
        conversationMemory[contactId].shift();
      }

      // 发送 AI 回复到群
      group.sendMessage(new PlainText(content));

    } catch (error) {
      console.error("请求出现错误：", error);
    }
  }
  // ====================================================================

  if (message.contentToString().includes('思考fwz')) {
    // 先给群发一条提示消息
    const group = Group.make(contactId);
    group.sendMessage(new PlainText('正在思考'));

    // 将“赛博fwz”替换掉，只保留用户的真实问题
    const question = message.contentToString().replaceAll('思考fwz', '');


    // 发起请求并带上当前的对话数组
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer apikey",
        },
        body: JSON.stringify({
          model: "deepseek-reasoner",
          messages:  [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": question}
          ],  // 这里带上所有对话上下文
          stream: false,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content ?? "抱歉，我暂时无法回答。";

      // 发送 AI 回复到群
      group.sendMessage(new PlainText(content));

    } catch (error) {
      console.error("请求出现错误：", error);
    }
  }
  // ====================================================================

  if (message.contentToString().includes('小说fwz')) {
    // 先给群发一条提示消息
    const group = Group.make(contactId);
    group.sendMessage(new PlainText('正在写小说,会稍微久一些,内容会有1200字'));

    // 将“赛博fwz”替换掉，只保留用户的真实问题
    const question = message.contentToString().replaceAll('小说fwz', '');
    
    const url = 'https://www.gpt4novel.com/api/xiaoshuoai/ext/v1/chat/completions';
  
    // 请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer apikey',
    };
    
    // 请求体
    const body = JSON.stringify({
      model: 'nalang-max',
      messages: [
        { role: 'system', content: '每次轻微推进故事发展，一次性写1200字，要求故事发展进度极慢，详细写心里细节、服装细节、外貌细节、动作细节、身体疲劳程度的细节，而不推进剧情发展' },
        { role: 'user', content: question},
      ],
      stream: true, // 确保启用流式传输
    });
    
    try {
      // 发送POST请求
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! 状态: ${response.status}`);
      }
      
      // 获取响应的读取器
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let { value: chunk, done: readerDone } = await reader.read();
      let buffer = '';
      let fullContent = '';
      
      while (!readerDone) {
        // 解码当前块
        buffer += decoder.decode(chunk, { stream: true });
        
        // 按行分割
        let lines = buffer.split('\n');
        
        // 保留最后一行（可能是不完整的）
        buffer = lines.pop();
        
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('data:')) {
            const jsonStr = line.replace(/^data:\s*/, '');
            if (jsonStr === '[DONE]') {
              // 结束标志
              break;
            }
            try {
              const json = JSON.parse(jsonStr);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                // 可选：在这里可以实时显示内容，如在网页上追加文本
                console.log(content);
              }
            } catch (e) {
              console.error('JSON解析错误:', e);
            }
          }
        }
        
        // 读取下一块
        ({ value: chunk, done: readerDone } = await reader.read());
      }
      
      // 处理剩余的缓冲区
      if (buffer.length > 0) {
        const line = buffer.trim();
        if (line.startsWith('data:')) {
          const jsonStr = line.replace(/^data:\s*/, '');
          if (jsonStr !== '[DONE]') {
            try {
              const json = JSON.parse(jsonStr);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                console.log(content);
              }
            } catch (e) {
              console.error('JSON解析错误:', e);
            }
          }
        }
      }
      
      console.log('完整内容:', fullContent);
      group.sendMessage(new PlainText(fullContent));
      
    } catch (error) {
      console.error('请求失败:', error);
    }
  
  }
   // ====================================================================


 

});
