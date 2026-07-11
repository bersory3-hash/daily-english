# daily-english
영어 학습 앱

## 📬 매일 아침 카카오톡으로 3세 영어 3문장 받기

`kakao/` 폴더의 프로그램이 매일 아침 8시(KST)에 GitHub Actions로 자동 실행되어,
3세 아이에게 맞는 영어 3문장을 카카오톡 **'나에게 보내기'** 메시지로 보내줍니다.
문장은 `kakao/sentences.mjs`에 미리 준비된 60개 세트(아침 인사, 목욕 시간, 감정 표현 등)에서
날짜에 따라 순환하며 선택됩니다.

### 최초 설정 방법 (한 번만 하면 됩니다)

1. **카카오 개발자 앱 만들기**
   - https://developers.kakao.com 에서 앱 생성 후, **REST API 키**를 확인해둡니다.
   - "카카오 로그인" 활성화 → **플랫폼 설정 > Web**에 아래 Redirect URI를 등록합니다.
     ```
     http://localhost:5500/oauth
     ```
   - **제품 설정 > 카카오톡 메시지**를 활성화합니다.
   - **동의항목**에서 `talk_message`(카카오톡 메시지 전송) 항목을 "필수 동의"로 설정합니다.
   - **앱 설정 > 팀 관리**에서 본인의 카카오 계정을 팀원으로 등록합니다.
     (앱이 검수를 받지 않은 "개발" 상태에서는 팀원으로 등록된 계정만 사용할 수 있어요. 본인 전용 봇이므로 이것으로 충분합니다.)

2. **refresh_token 발급받기 (로컬 컴퓨터에서 1회 실행)**
   ```bash
   cd kakao
   npm install
   KAKAO_REST_API_KEY=발급받은REST키 npm run auth
   ```
   터미널에 출력된 주소를 브라우저에 열어 카카오 로그인/동의를 완료하면,
   터미널에 `KAKAO_REST_API_KEY`와 `KAKAO_REFRESH_TOKEN` 값이 출력됩니다.

3. **GitHub 저장소에 Secrets 등록**
   - 저장소 **Settings > Secrets and variables > Actions > New repository secret**에서 아래 두 개를 등록합니다.
     - `KAKAO_REST_API_KEY`
     - `KAKAO_REFRESH_TOKEN`
   - (선택) `ADMIN_GH_TOKEN`: `repo` 권한을 가진 GitHub Personal Access Token.
     등록해두면 카카오 refresh_token이 자동으로 갱신될 때마다 이 프로그램이 위 시크릿을 스스로 최신 값으로 업데이트합니다.
     등록하지 않으면 카카오 refresh_token 만료 주기(최대 약 60일)에 맞춰 2번 과정을 다시 실행해 값을 갱신해주면 됩니다.

4. **완료!**
   - `.github/workflows/daily-kakao-message.yml` 워크플로우가 매일 08:00(KST)에 자동 실행됩니다.
   - GitHub 저장소의 **Actions** 탭에서 "Daily Kakao English Message" 워크플로우를 선택해
     **Run workflow** 버튼으로 바로 테스트 발송도 가능합니다.

