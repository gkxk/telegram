const axios = require('axios');
const fs = require('fs');
const secret = require('../.secret');

async function get_text() {
	let url = `https://disqus.com/api/3.0/posts/list.json?related=thread&api_key=${secret.disqus_apikey}&forum=gkxk&limit=5&order=asc`;
	return await axios.get(url)
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

			let cache = JSON.parse(fs.readFileSync('./.cache.json'));

			// 滤去已经发送过的: 即, link在cache['received']数组中的
			const newReplies = replies.filter(reply => {
				return !cache['msg'].includes(reply.link);
			});
			if (newReplies.length == 0) {
				cache['interval']['disqus'] = Math.min(cache['interval']['disqus'] * 2, 64);
				fs.writeFileSync('./.cache.json', JSON.stringify(cache));
				return;
			}
			cache['interval']['disqus'] = 2

			// 写入cache
			cache['msg'] = cache['msg'].concat(newReplies.map(reply => reply.link));
			fs.writeFileSync('./.cache.json', JSON.stringify(cache));

			// 将newReplies组装为语料, 发送到telegram
			const text = newReplies.map(reply => {
				// 时间转化为东八区时间
				return `${reply.author} ${new Date(reply.date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n${reply.link}\n${reply.content}`;
			}).join('\n\n--------------------------------\n\n');

			return text
		})
}

exports.get_text = get_text