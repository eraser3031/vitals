import OpenAI from 'openai'

// Notion OAuth 토큰 임시 저장 (메모리, 60초 만료)
const notionPendingTokens = new Map<string, { token: string; expiresAt: number }>()

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

		// Notion OAuth: 브라우저에서 리다이렉트 → code → token 교환 → 임시 저장
		if (url.pathname === '/notion/oauth/callback' && request.method === 'GET') {
			const code = url.searchParams.get('code')
			const state = url.searchParams.get('state') || ''
			if (!code) return new Response('Missing code', { status: 400 })

			const credentials = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`)

			const res = await fetch('https://api.notion.com/v1/oauth/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Basic ${credentials}`,
				},
				body: JSON.stringify({
					grant_type: 'authorization_code',
					code,
					redirect_uri: `${url.origin}/notion/oauth/callback`,
				}),
			})

			const data = (await res.json()) as { access_token?: string; error?: string }

			if (data.access_token) {
				// state를 키로 토큰 임시 저장 (앱이 폴링으로 가져감)
				notionPendingTokens.set(state, { token: data.access_token, expiresAt: Date.now() + 60000 })

				return new Response(
					'<html><head><meta charset="utf-8"></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;color:#333"><div>Notion 연결 완료. 이 창을 닫아도 됩니다.</div></body></html>',
					{ headers: { 'Content-Type': 'text/html; charset=utf-8' } },
				)
			}

			return new Response(`Notion OAuth failed: ${data.error || 'unknown'}`, { status: 400 })
		}

		// Notion OAuth: 앱이 토큰을 폴링
		if (url.pathname === '/notion/oauth/poll' && request.method === 'POST') {
			const { state } = (await request.json()) as { state: string }
			const pending = notionPendingTokens.get(state)

			if (pending && Date.now() < pending.expiresAt) {
				notionPendingTokens.delete(state)
				return new Response(JSON.stringify({ access_token: pending.token }), {
					headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
				})
			}

			return new Response(JSON.stringify({ access_token: null }), {
				headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
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
