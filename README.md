# 우리집 저금통 🐷

아이가 갖고 싶은 장난감 사진을 목표로 등록하면, **흑백 그림으로 깔리고 저축할수록 컬러로 차오르는** 시각화 저금통 PWA입니다. 저축은 지폐를 카메라로 찍으면 일련번호와 금액을 읽어 기록하고, 같은 지폐는 두 번 세지 않습니다.

## 바로 보기 (데모 모드)

`index.html` 하나만 브라우저로 열면 설정 없이 데모로 동작합니다. 두 아이(민준·서준)와 예시 목표가 들어 있고, **저축하기**를 누르면 그림이 부드럽게 차오릅니다. (데모에선 카메라 대신 가짜 인식이 돌고, 데이터는 새로고침하면 초기화됩니다.)

## 주요 기능

- 목표 사진 촬영/업로드 → **브라우저에서 배경 자동 제거**(장난감 윤곽만) → 흑백→컬러로 차오름
- 채워지는 경계가 **물이 차오르듯 부드럽게** 표현됨
- 지폐 촬영 저축: 카메라 → **Google Cloud Vision OCR** → 일련번호·금액 인식
- **같은 지폐 중복 저축 차단** (일련번호 + 금액 조합)
- **두 아이 분리 저장** (Supabase)
- **홈화면 설치 PWA** (오프라인에서도 화면 표시)

## 파일 구조

```
.
├─ index.html              # 앱 본체 (화면·로직)  ← 데모는 이 파일만으로 동작
├─ api/recognize-bill.js   # 지폐 인식 서버함수(Vercel). Vision 키를 여기서만 사용
├─ schema.sql              # Supabase 테이블·스토리지·정책·시드
├─ manifest.webmanifest    # PWA 설치 정보
├─ sw.js                   # 서비스워커(오프라인 캐시)
├─ icon.svg                # 홈화면 아이콘
└─ .env.example            # 서버 환경변수 예시
```

## 배포 (Vercel + Supabase)

1. **Supabase** — 프로젝트를 만들고 SQL Editor에 `schema.sql`을 실행합니다. 테이블·`goal-images` 스토리지 버킷·시드가 생성됩니다. 설정에서 **Project URL**과 **anon public key**를 복사해 둡니다.
2. **Google Cloud / Vercel** — Cloud Vision API를 사용 설정하고 API 키를 발급합니다. 이 저장소를 Vercel로 Import한 뒤, 프로젝트 환경변수에 `GCP_VISION_KEY`를 등록합니다(`.env.example` 참고).
3. **CONFIG 채우기** — `index.html` 상단 `CONFIG`의 세 값을 채웁니다.
   ```js
   const CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...",
     RECOGNIZE_ENDPOINT: "https://<배포주소>/api/recognize-bill",
   };
   ```
4. 배포 후 태블릿 크롬에서 주소를 열고 **‘홈 화면에 추가’** 를 누르면 앱처럼 설치됩니다.

> 서비스워커와 카메라는 **HTTPS에서만** 동작합니다. Vercel은 기본 HTTPS라 그대로 됩니다.

## 보안 메모

- **Vision API 키는 절대 브라우저에 두지 않습니다.** `api/recognize-bill.js`의 환경변수에만 둡니다.
- Supabase **anon key는 공개되는 값**입니다. 지금은 가정용 단일 기기 전제로 RLS를 전체 허용해 두었으니, 외부에 공개하는 앱이라면 Supabase Auth로 정책을 강화하세요.

## 참고

- 배경 제거는 **단순한 배경에서** 가장 깔끔합니다. 복잡한 배경까지 정밀히 지우려면 `@imgly/background-removal` 같은 라이브러리로 `removeBackground` 부분을 교체할 수 있습니다.
- 부드러운 차오름은 CSS `@property`와 `mask`를 사용하므로 **최신 브라우저(크롬·사파리 등)** 를 권장합니다.
