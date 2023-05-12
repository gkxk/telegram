const axios = require('axios');
const fs = require('fs');
const secret = require('../.secret');
const cheerio = require('cheerio');

async function get_text() {
	return await axios.get(secret.v2ex_url)
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
		let cache = JSON.parse(fs.readFileSync('./.cache.json'));

		// 滤去已经发送过的: 即, link在cache['received']数组中的
		const newReplies = replies.filter(reply => {
			return !cache['msg'].includes(reply.link);
		});
		if(newReplies.length == 0) {
			cache['interval']['v2ex'] = Math.min(cache['interval']['v2ex'] * 2, 64);
			fs.writeFileSync('./.cache.json', JSON.stringify(cache));
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

		return text
	})
}

exports.get_text = get_text