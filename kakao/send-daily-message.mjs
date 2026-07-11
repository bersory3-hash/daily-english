// 매일 아침, 3세 아이용 영어 3문장을 카카오톡 '나에게 보내기'로 전송합니다.
// 필요 환경변수:
//   KAKAO_REST_API_KEY   - 카카오 개발자 앱의 REST API 키
//   KAKAO_REFRESH_TOKEN  - 최초 1회 인증(get-kakao-token.mjs)으로 발급받은 refresh_token
//   ADMIN_GH_TOKEN        - (선택) refresh_token이 회전될 때 GitHub Secret을 자동 갱신하기 위한 PAT (repo scope)
//   GITHUB_REPOSITORY     - GitHub Actions가 자동으로 채워줌 ("owner/repo")

import sentences from "./sentences.mjs";

const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const REFRESH_TOKEN = process.env.KAKAO_REFRESH_TOKEN;
const ADMIN_GH_TOKEN = process.env.ADMIN_GH_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const LINK_URL =
  process.env.KAKAO_LINK_URL || "https://github.com/bersory3-hash/daily-english";

if (!REST_API_KEY || !REFRESH_TOKEN) {
  console.error(
    "KAKAO_REST_API_KEY / KAKAO_REFRESH_TOKEN 환경변수가 필요합니다. README의 설정 가이드를 참고하세요."
  );
  process.exit(1);
}

function getTodayIndexKST() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year").value);
  const m = Number(parts.find((p) => p.type === "month").value);
  const d = Number(parts.find((p) => p.type === "day").value);

  const todayUTC = Date.UTC(y, m - 1, d);
  const startOfYearUTC = Date.UTC(y, 0, 1);
  const dayOfYear = Math.round((todayUTC - startOfYearUTC) / 86400000);
  return dayOfYear % sentences.length;
}

async function refreshAccessToken() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: REST_API_KEY,
    refresh_token: REFRESH_TOKEN,
  });
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`카카오 토큰 갱신 실패: ${JSON.stringify(data)}`);
  }
  return data;
}

function buildListenUrl(englishText) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(
    englishText
  )}`;
}

function buildMessageText(dayEntry) {
  const lines = dayEntry.sentences.map(
    (s, i) =>
      `${i + 1}. ${s.english}\n   [${s.pron}]\n   ${s.korean}\n   🔊 ${buildListenUrl(
        s.english
      )}`
  );
  return [
    `🧸 오늘의 3세 영어 3문장 (${dayEntry.theme})`,
    "",
    lines.join("\n\n"),
    "",
    `💡 ${dayEntry.tip}`,
  ].join("\n");
}

async function sendKakaoMessage(accessToken, text) {
  const templateObject = {
    object_type: "text",
    text,
    link: {
      web_url: LINK_URL,
      mobile_web_url: LINK_URL,
    },
  };
  const params = new URLSearchParams({
    template_object: JSON.stringify(templateObject),
  });
  const res = await fetch(
    "https://kapi.kakao.com/v2/api/talk/memo/default/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`카카오톡 메시지 전송 실패: ${JSON.stringify(data)}`);
  }
  return data;
}

async function updateGithubSecret(secretName, secretValue) {
  if (!ADMIN_GH_TOKEN || !GITHUB_REPOSITORY) {
    console.warn(
      "ADMIN_GH_TOKEN이 없어 회전된 refresh_token을 자동 저장하지 못했습니다. " +
        "KAKAO_REFRESH_TOKEN 시크릿을 수동으로 최신값으로 갱신해주세요."
    );
    return;
  }

  const sodiumModule = await import("libsodium-wrappers");
  const sodium = sodiumModule.default;
  await sodium.ready;

  const keyRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_GH_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!keyRes.ok) {
    console.warn(`GitHub public key 조회 실패: ${await keyRes.text()}`);
    return;
  }
  const keyData = await keyRes.json();

  const messageBytes = sodium.from_string(secretValue);
  const keyBytes = sodium.from_base64(
    keyData.key,
    sodium.base64_variants.ORIGINAL
  );
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  const encryptedValue = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  const putRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ADMIN_GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: keyData.key_id,
      }),
    }
  );

  if (!putRes.ok) {
    console.warn(`GitHub 시크릿 업데이트 실패: ${await putRes.text()}`);
  } else {
    console.log(`✅ ${secretName} 시크릿을 새 refresh_token으로 갱신했습니다.`);
  }
}

async function main() {
  const idx = getTodayIndexKST();
  const dayEntry = sentences[idx];
  console.log(`오늘 문장 세트(#${idx}, ${dayEntry.theme})를 전송합니다.`);

  const tokenData = await refreshAccessToken();
  const text = buildMessageText(dayEntry);
  await sendKakaoMessage(tokenData.access_token, text);
  console.log("✅ 카카오톡 '나에게 보내기' 메시지를 성공적으로 보냈습니다.");

  if (tokenData.refresh_token) {
    await updateGithubSecret("KAKAO_REFRESH_TOKEN", tokenData.refresh_token);
  }
}

main().catch((err) => {
  console.error("❌ 실행 중 오류가 발생했습니다:", err.message || err);
  process.exit(1);
});
