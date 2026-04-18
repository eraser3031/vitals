import OpenAI from 'openai'

function corsHeaders(origin: string | null) {
	return {
		'Access-Control-Allow-Origin': origin || '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url)
		const origin = request.headers.get('Origin')

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders(origin) })
		}

		// GitHub OAuth: code → access_token 교환
		if (url.pathname === '/github/oauth/token' && request.method === 'POST') {
			const { code } = (await request.json()) as { code: string }

			const res = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify({
					client_id: env.GITHUB_CLIENT_ID,
					client_secret: env.GITHUB_CLIENT_SECRET,
					code,
				}),
			})

			const data = await res.json()

			return new Response(JSON.stringify(data), {
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders(origin),
				},
			})
		}

		// AI chat
		if (url.pathname === '/ai/chat' && request.method === 'POST') {
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

			const body = (await request.json()) as { messages: { role: string; content: string }[] }

			const stream = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: body.messages,
				stream: true,
			})

			const readable = new ReadableStream({
				async start(controller) {
					for await (const chunk of stream) {
						const text = chunk.choices[0]?.delta?.content || ''
						if (text) {
							controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`))
						}
					}
					controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
					controller.close()
				},
			})

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					...corsHeaders(origin),
				},
			})
		}

		// 헬스체크
		if (request.method === 'GET' && url.pathname === '/') {
			return new Response('Vitals AI Worker is running')
		}

		return new Response('Not found', { status: 404 })
	},
} satisfies ExportedHandler<Env>
