// ───────────────────────────────────────────────────────────
// Vercel Serverless Function  ·  파일 위치: /api/recognize-bill.js
//
// 역할: 브라우저가 보낸 지폐 사진(base64)을 Google Cloud Vision으로 읽어
//       일련번호와 권종을 돌려줍니다. Vision API 키는 브라우저에 노출되지 않고
//       이 서버 함수의 환경변수(GCP_VISION_KEY) 안에만 존재합니다.
//
// 준비:
//   1) Google Cloud Console → Vision API 사용 설정
//   2) API 키 발급 후 Vercel 프로젝트 → Settings → Environment Variables 에
//      GCP_VISION_KEY = (발급한 키) 등록
//   3) git push 하면 https://<배포주소>/api/recognize-bill 로 호출됩니다.
// ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 만 지원합니다.' });
    return;
  }
  try {
    const { image } = req.body || {};
    if (!image) {
      res.status(400).json({ error: 'image(base64) 가 필요합니다.' });
      return;
    }

    const key = process.env.GCP_VISION_KEY;
    if (!key) {
      res.status(500).json({ error: '서버에 GCP_VISION_KEY 가 설정되지 않았습니다.' });
      return;
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },          // data:image/... 접두어는 제거된 순수 base64
            features: [{ type: 'TEXT_DETECTION' }],
            imageContext: { languageHints: ['ko', 'en'] },
          }],
        }),
      }
    );

    const data = await visionRes.json();
    const text = data?.responses?.[0]?.fullTextAnnotation?.text || '';
    const { serial, amount } = parseBill(text);

    // serial 또는 amount 를 못 읽으면 프런트에서 "다시 찍어 주세요" 안내
    res.status(200).json({ serial, amount, rawText: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

// 인식된 전체 텍스트에서 권종과 일련번호를 추출 (실제 지폐로 테스트하며 정규식 튜닝 권장)
function parseBill(text) {
  const flat = text.replace(/[,\s]/g, '');

  // 권종: 인쇄된 숫자 중 가장 큰 화폐 단위
  let amount = null;
  for (const d of [50000, 10000, 5000, 1000]) {
    if (flat.includes(String(d))) { amount = d; break; }
  }

  // 일련번호: 글자(영문/한글) 1~2개 + 숫자 6~8자리 (+끝글자) 패턴
  const m = text.match(/[A-Z가-힣]{1,2}\s?\d{6,8}\s?[A-Z가-힣]?/);
  const serial = m ? m[0].replace(/\s/g, '') : null;

  return { serial, amount };
}
