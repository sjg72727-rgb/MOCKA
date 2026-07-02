module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
        }

        const { image, mimeType } = req.body;

        if (!image) {
            return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
        }

        const prompt = "이 이미지는 카페의 메뉴판입니다. 이미지 속에 있는 음료와 디저트의 '메뉴 이름'만 추출해서 콤마(,)로 구분된 텍스트로만 대답해줘. 가격이나 사이즈, 부연 설명, 장식용 문구는 전부 제외하고 순수하게 메뉴 이름만 나열해줘. 예시: 아메리카노, 카페라떼, 초코 케이크";

        // 다이렉트 REST API 호출 (가장 안정적인 v1 버전 명시)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: image
                        }
                    }
                ]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 구글 서버에서 에러를 뱉었을 경우 투명하게 클라이언트로 전달
        if (!response.ok) {
            console.error('Gemini API Error Response:', data);
            return res.status(500).json({ error: `구글 서버 거절: ${data.error?.message || '이유 불명'}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            console.error('Gemini API No Candidates:', data);
            return res.status(500).json({ error: 'AI가 응답을 생성하지 못했습니다 (안전 정책 차단 등).' });
        }

        const text = data.candidates[0].content.parts[0].text || '';

        const menus = text.split('\n')
            .map(line => line.replace(/^- /, '').replace(/,/g, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ menus: menus });

    } catch (error) {
        console.error('Fetch Error:', error);
        return res.status(500).json({ error: '서버 통신 중 치명적인 오류가 발생했습니다.' });
    }
}
