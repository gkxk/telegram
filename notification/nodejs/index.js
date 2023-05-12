const express = require("express");
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json())

const get_v2ex_text = require('./source/v2ex').get_text;
const get_disqus_text = require('./source/disqus').get_text;

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
var cron = require('node-cron');
const fs = require('fs');

const secret = require('./.secret');
const token = secret.telegram_token;
const bot = new TelegramBot(token, {polling: true});


// 对于 message == "addme", 将chat_id加入到cache.telegram_chat_id
bot.on('message', (msg) => {
	if (msg.text == 'addme') {
		cache['telegram_chat_id'].push(msg.chat.id);
		cache['telegram_chat_id'] = [...new Set(cache['telegram_chat_id'])];
		fs.writeFileSync('./.cache.json', JSON.stringify(cache));
		bot.sendMessage(msg.chat.id, '已添加');
	}
});


let source_list=['v2ex','disqus','bilibili','github','zhihu','twitter']
let timer_i = 0
cron.schedule('* */1 * * * *', async () => {
	source_list.forEach(async (source) => {
		let cache = JSON.parse(fs.readFileSync('./.cache.json'));
		cache['interval'][source] = cache['interval'][source] || 2;
		if(timer_i % cache['interval'][source] == 0) {
			let text = ''
			if(source == 'v2ex') text = await get_v2ex_text();
			else if(source == 'disqus') text = await get_disqus_text();

			if(!text)
				return

			// 发送到telegram
			for (let chat_id of cache['telegram_chat_id']) {
				bot.sendMessage(chat_id, text);
			}
		}
	})
	timer_i=(timer_i+1)%Math.pow(2,32);
});


app.post("/", (req, res, next) => {
  let { content } = req.body;
  if(content)
	for (let chat_id of cache['telegram_chat_id']) {
		bot.sendMessage(chat_id, content);
	}
  res.send("ok");
})

app.listen(3000, () => {console.log("服务启动成功");})