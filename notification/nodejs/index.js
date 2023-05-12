const express = require("express");
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json())

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
var cron = require('node-cron');
const cheerio = require('cheerio');
const fs = require('fs');

const secret = require('./.secret');
const token = secret.telegram_token;
const bot = new TelegramBot(token, {polling: true});

// 读取本地.cache.json
let cache = {};
if (fs.existsSync('./.cache.json')) {
	cache = JSON.parse(fs.readFileSync('./.cache.json'));
}
cache['msg'] = cache['msg'] || [];
cache['interval'] = cache['interval'] || {};


// 对于 message == "addme", 将chat_id加入到cache.telegram_chat_id
bot.on('message', (msg) => {
	if (msg.text == 'addme') {
		cache['telegram_chat_id'].push(msg.chat.id);
		cache['telegram_chat_id'] = [...new Set(cache['telegram_chat_id'])];
		fs.writeFileSync('./.cache.json', JSON.stringify(cache));
		bot.sendMessage(msg.chat.id, '已添加');
	}
});

async function send_v2ex() {
	axios.get(secret.v2ex_url)
	.then(function (response) {
		// handle success
		const $ = cheerio.load(response.data);
		// 获取所有 entry, 组成数组
		const entries = $('entry');

		let replies=[]
		entries.each((i, entry) => {
			const title = $(entry).find('title').text();
			const link = $(entry).find('link').attr('href');
			const date = $(entry).find('published').text();
			const author = $(entry).find('author > name').text();
			const author_url = $(entry).find('author > uri').text();

			let content = $(entry).find('content').html();
			// 去除: "<!--[CDATA[", "]]-->", "]]&gt;", "<br /-->", "<br>". 之后去除首尾空格
			content = content.replace(/<!--\[CDATA\[/g, '').replace(/\]\]-->/g, '').replace(/\]\]&gt;/g, '').replace(/<br \/-->/g, '').replace(/<br>/g, '').trim();

			replies.push({
				title,
				link,
				date,
				author,
				author_url,
				content
			});
		});

		// 滤去已经发送过的: 即, link在cache['received']数组中的
		const newReplies = replies.filter(reply => {
			return !cache['msg'].includes(reply.link);
		});
		if(newReplies.length == 0) {
			cache['interval']['v2ex'] = Math.min(cache['interval']['v2ex'] * 2, 64);
			return;
		}
		cache['interval']['v2ex'] = 2

		// 写入cache['received']
		cache['msg'] = cache['msg'].concat(newReplies.map(reply => reply.link));
		fs.writeFileSync('./.cache.json', JSON.stringify(cache));

		// 将newReplies组装为语料, 发送到telegram
		// 先转化: `${reply.title}\n${reply.link}\n${reply.date}\n${reply.content}`;, 再join
		const text = newReplies.map(reply => {
			// 时间转化为东八区时间
			return `${reply.author} ${new Date(reply.date).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n${reply.link}\n${reply.content}`;
		}).join('\n\n--------------------------------\n\n');
		
		for (let chat_id of cache['telegram_chat_id']) {
			bot.sendMessage(chat_id, text);
		}
	})
}

async function send_disqus() {
	let url=`https://disqus.com/api/3.0/posts/list.json?related=thread&api_key=${secret.disqus_apikey}&forum=gkxk&limit=5&order=asc`;
	axios.get(url)
	.then(function (response) {
		// handle success
		const data = response.data;
		const posts = data.response;
		let replies = [];
		posts.forEach(post => {
			const title = post.thread.title;
			const link = post.url;
			const date = post.createdAt;
			const author = post.author.name;
			let content = post.raw_message;

			replies.push({
				title,
				link,
				date,
				author,
				content
			});
		});

		// 滤去已经发送过的: 即, link在cache['received']数组中的
		const newReplies = replies.filter(reply => {
			return !cache['msg'].includes(reply.link);
		});
		if(newReplies.length == 0) {
			cache['interval']['disqus'] = Math.min(cache['interval']['disqus'] * 2, 64);
			return;
		}
		cache['interval']['disqus'] = 2

		// 写入cache
		cache['msg'] = cache['msg'].concat(newReplies.map(reply => reply.link));
		fs.writeFileSync('./.cache.json', JSON.stringify(cache));

		// 将newReplies组装为语料, 发送到telegram
		const text = newReplies.map(reply => {
			// 时间转化为东八区时间
			return `${reply.author} ${new Date(reply.date).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n${reply.link}\n${reply.content}`;
		}).join('\n\n--------------------------------\n\n');

		for (let chat_id of cache['telegram_chat_id']) {
			bot.sendMessage(chat_id, text);
		}
	})
}


cache['interval']['v2ex'] = cache['interval']['v2ex'] || 2;
cache['interval']['disqus'] = cache['interval']['disqus'] || 32;
let timer_i = 0
cron.schedule('* */1 * * * *', () => {
	for(let key in cache['interval']) {
		if(timer_i % cache['interval'][key] == 0) {
			if(key == 'v2ex') {
				send_v2ex();
			}
			if(key == 'disqus') {
				send_disqus();
			}
		}
	}
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