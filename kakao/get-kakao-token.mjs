// 최초 1회, 로컬 컴퓨터에서 직접 실행하는 카카오 로그인 인증 도구입니다.
// 실행 후 안내되는 주소를 브라우저에 열어 카카오 로그인/동의를 완료하면
// 자동화(daily-kakao-message.yml)에 필요한 refresh_token을 얻을 수 있습니다.
//
// 사용법:
//   cd kakao
//   npm install
//   KAKAO_REST_API_KEY=발급받은REST키 npm run auth

import http from "node:http";

const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || "http://localhost:5500/oauth";

if (!REST_API_KEY) {
  console.error("사용법: KAKAO_REST_API_KEY=발급받은키 npm run auth");
  process.exit(1);
}

const redirectPort = Number(new URL(REDIRECT_URI).port || 80);
const redirectPath = new URL(REDIRECT_URI).pathname;

const authorizeUrl =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${encodeURIComponent(REST_API_KEY)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=talk_message`;

console.log("\n1) 아래 주소를 브라우저에 열고 카카오 로그인 후 동의해주세요:\n");
console.log(authorizeUrl + "\n");
console.log(`2) 카카오 개발자 콘솔 > 플랫폼 설정의 Redirect URI가 다음과 정확히 일치해야 합니다: ${REDIRECT_URI}\n`);
console.log("3) 로그인/동의 완료를 기다리는 중...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== redirectPath) {
    res.end("이 경로는 사용하지 않습니다.");
    return;
  }

  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    res.end(`카카오 인증이 취소되었습니다: ${errorParam}`);
    console.error(`❌ 인증 취소/실패: ${errorParam}`);
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    res.end("인증 코드가 없습니다. 다시 시도해주세요.");
    return;
  }

  res.end("인증이 완료되었습니다! 터미널을 확인하세요. 이 창은 닫으셔도 됩니다.");

  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    });
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("❌ 토큰 발급 실패:", tokenData);
    } else {
      console.log("\n✅ 토큰 발급 성공! 아래 두 값을 GitHub 저장소 Settings > Secrets and variables > Actions 에 등록하세요:\n");
      console.log(`KAKAO_REST_API_KEY = ${REST_API_KEY}`);
      console.log(`KAKAO_REFRESH_TOKEN = ${tokenData.refresh_token}\n`);
    }
  } catch (e) {
    console.error("❌ 토큰 교환 중 오류:", e);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(redirectPort, () => {});
