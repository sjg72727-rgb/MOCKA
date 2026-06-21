const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image, mimeType } = req.body;
        
        if (!image || !mimeType) {
            return res.status(400).json({ error: 'Missing image data' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Use Gemini 1.5 Flash for fast multimodal tasks
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = "이 이미지는 카페의 메뉴판입니다. 이미지 속에 있는 음료와 디저트의 '메뉴 이름'만 추출해서 콤마(,)로 구분된 텍스트로만 대답해줘. 가격이나 사이즈, 부연 설명, 장식용 문구는 전부 제외하고 순수하게 메뉴 이름만 나열해줘. 예시: 아메리카노, 카페라떼, 초코 케이크";

        const imageParts = [
            {
                inlineData: {
                    data: image,
                    mimeType: mimeType
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Parse comma separated string to array
        const menuArray = text.split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !item.includes('가격') && !item.includes('\\'));

        return res.status(200).json({ menus: menuArray });
        
    } catch (error) {
        console.error("AI API Error:", error);
        return res.status(500).json({ error: '메뉴 추출에 실패했습니다.', details: error.message });
    }
}
