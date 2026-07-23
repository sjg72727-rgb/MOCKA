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

        const prompt = `이 이미지는 카페의 메뉴판입니다. 이미지 속에 있는 음료와 디저트의 '메뉴 이름'과 '가격'을 모두 추출해서 한 줄에 하나씩(엔터로 구분) 대답해줘.
중요한 규칙:
1. 가격이 표(테이블) 형태로 되어 있어서 원두 이름(가로줄)과 음료 종류(세로줄)가 십자(X)로 만나는 형태라면, 두 이름을 기호(-)로 합쳐서 구체적으로 적어줘. (예: 녹턴-Americano 5,000원)
2. Latte, Espresso 같은 큰 카테고리 아래에 메뉴들이 적혀있다면 카테고리 이름을 참고해서 적절히 적어줘.
3. 가격은 항상 숫자 뒤에 '원'을 붙여서 통일해줘. (예: 5,000원)
4. 오직 [메뉴이름 가격] 형태의 텍스트만 한 줄에 하나씩 출력해줘. 불필요한 부연 설명이나 기호(*, 번호 등)로 문장을 시작하지 마.
예시 출력:
녹턴-Americano 5,000원
녹턴-Drip 6,000원
과테말라-Americano 6,000원
세레나데 6,000원`;

        // 1단계: 사용자님의 API 키가 어떤 모델들에 접근 가능한지 동적으로 목록을 가져옵니다.
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const modelsRes = await fetch(modelsUrl);
        const modelsData = await modelsRes.json();

        if (!modelsRes.ok) {
            return res.status(500).json({ error: `권한 확인 실패: ${modelsData.error?.message}` });
        }

        // 사용 가능한 모델 목록 추출
        const availableModels = modelsData.models || [];
        
        // 글/이미지를 생성할 수 있는(generateContent) 모델만 필터링
        const generateModels = availableModels.filter(m => 
            m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
        );

        if (generateModels.length === 0) {
            return res.status(500).json({ error: `사용 가능한 AI 모델이 하나도 없습니다.` });
        }

        // 가장 똑똑한 모델부터 우선순위로 찾아냅니다. (Flash -> Pro -> Vision -> 아무거나)
        let selectedModel = generateModels.find(m => m.name.includes('1.5-flash'));
        if (!selectedModel) selectedModel = generateModels.find(m => m.name.includes('1.5-pro'));
        if (!selectedModel) selectedModel = generateModels.find(m => m.name.includes('pro-vision'));
        if (!selectedModel) selectedModel = generateModels[0]; // 없으면 목록에 있는 첫 번째 모델 강제 선택

        const targetModelName = selectedModel.name; // 예: "models/gemini-1.5-flash" 또는 "models/gemini-pro-vision"

        // 2단계: 찾아낸 가장 완벽한 모델 이름으로 실제 이미지 분석 요청을 보냅니다.
        const url = `https://generativelanguage.googleapis.com/v1beta/${targetModelName}:generateContent?key=${apiKey}`;

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

        if (!response.ok) {
            return res.status(500).json({ error: `(${targetModelName}) 거절: ${data.error?.message || '이유 불명'}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: 'AI가 이미지를 읽었으나 응답을 만들지 못했습니다.' });
        }

        const text = data.candidates[0].content.parts[0].text || '';

        // 줄바꿈으로 분리하고 불필요한 기호 제거
        const menus = text.split('\n')
            .map(line => line.replace(/^- /, '').replace(/^\d+\./, '').replace(/,/g, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ menus: menus });

    } catch (error) {
        console.error('Fetch Error:', error);
        return res.status(500).json({ error: '서버 통신 중 치명적인 오류가 발생했습니다.' });
    }
}
