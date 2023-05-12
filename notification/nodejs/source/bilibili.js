const axios = require('axios');
const fs = require('fs');
const secret = require('../.secret');

async function get_text() {
	let token=secret.bilibili_token
	let url=`https://api.bilibili.com/x/msgfeed/reply`
	return axios.get(url, {
		headers: {
			'Cookie': `SESSDATA=${token}`
		}
	}).then(function (response) {
		let data=response.data
		let items=data.data.items
		let replies = [];
		items.forEach(item => {
			let id=`bili${item.id}`
			const author = item.user.nickname;
			const date = new Date(item.reply_time * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
			let content= item.item.source_content;
			let link=`https://message.bilibili.com?highlight=${content.slice(0,20)}`

			replies.push({
				link,
				id,
				author,
				date,
				content
			});
		});

		let cache = JSON.parse(fs.readFileSync('./.cache.json'));

		// 滤去已经发送过的
		const newReplies = replies.filter(reply => {
			return !cache['msg'].includes(reply.id);
		});
		if (newReplies.length == 0) {
			cache['interval']['bilibili'] = Math.min(cache['interval']['bilibili'] * 2, 64);
			fs.writeFileSync('./.cache.json', JSON.stringify(cache));
			return;
		}
		cache['interval']['bilibili'] = 2

		// 写入cache
		cache['msg'] = cache['msg'].concat(newReplies.map(reply => reply.id));
		fs.writeFileSync('./.cache.json', JSON.stringify(cache));

		// 将newReplies组装为语料
		let text = newReplies.map(reply => {
			// 时间转化为东八区时间
			return `[bili] ${reply.author} ${reply.date}\n${reply.content}`;
		}).join('\n\n--------------------------------\n\n');

		return text
	}).catch(function (error) {
		console.log(error);
		return error
	})
}

exports.get_text = get_text