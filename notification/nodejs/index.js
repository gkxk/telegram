const express = require("express");
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json())

const get_v2ex_text = require('./source/v2ex').get_text;
const get_disqus_text = require('./source/disqus').get_text;
const get_bilibili_text = require('./source/bilibili').get_text;

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
var cron = require('node-cron');
const fs = require('fs');

const secret = require('./.secret');
const token = secret.telegram_token;
const bot = new TelegramBot(token, {polling: true});

let source_list=['v2ex','disqus', 'bilibili']
let timer_i = 0
cron.schedule('* */1 * * * *', async () => {
	source_list.forEach(async (source) => {
		let cache = JSON.parse(fs.readFileSync('./.cache.json'));
		cache['interval'][source] = cache['interval'][source] || 2;
		if(timer_i % cache['interval'][source] == 0) {
			let text = ''
			if(source == 'v2ex') text = await get_v2ex_text();
			else if(source == 'disqus') text = await get_disqus_text();
			else if(source == 'bilibili') text = await get_bilibili_text();

			console.log(`${source}: ${text}`)
			if(!text)
				return

			// 发送到telegram
			for (let chat_id of cache['telegram_chat_id']) {
				bot.sendMessage(chat_id, text);
			}
		}
	})
	timer_i=(timer_i+1)%Math.pow(2,32);
	console.log(timer_i)
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