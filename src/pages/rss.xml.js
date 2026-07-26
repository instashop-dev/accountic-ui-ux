import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	return rss({
		title: `${SITE_TITLE} — Field notes`,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts
			.sort((a, b) => +b.data.pubDate - +a.data.pubDate)
			.map((post) => ({
				title: post.data.title,
				pubDate: post.data.pubDate,
				description: post.data.description,
				link: `/blog/${post.id}/`,
			})),
	});
}
