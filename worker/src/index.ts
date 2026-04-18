import OpenAI from 'openai'

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// GET → 헬스체크
		if (request.method === 'GET') {
			return new Response('Vitals AI Worker is running')
		}

		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 })
		}

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
				Connection: 'keep-alive',
			},
		})
	},
} satisfies ExportedHandler<Env>
