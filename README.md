# 온플랜 · HTML 버전

현재 기본 앱은 web/ 폴더의 독립 HTML·CSS·JavaScript 버전입니다. Next.js·React·Vercel 서버 API 없이 작동합니다. 학습 기록과 권한 검사는 Supabase에 유지합니다.

접속: https://onplan-coaching-three.vercel.app/

## 바로 사용

1. 관리자 → 기존 코치 계정 로그인.
2. 학생 추가 → 이름·학년 등록. 학생 이메일·비밀번호·Auth 계정은 만들지 않습니다.
3. 학생 현황 → 학생 링크 → 새 링크 발급 → 해당 학생에게 전달.
4. 학생은 링크를 열어 이름·학년을 확인하고 오늘 과제를 체크합니다.
5. 관리자는 오늘 체크와 누적 기록을 확인합니다. 기록은 Supabase에 저장되므로 사이트를 닫아도 유지됩니다.

가상 코치: planner-demo0@example.com. 비밀번호는 배포·소스 관리에서 제외된 .env.demo.local에 있습니다. 기존 가상 학생 2명과 계정 없이 등록한 가상학생 민준이 있습니다. 실제 학생 데이터는 사용하지 않았습니다.

## 내 PC에서 실행

프로젝트 루트의 실행하기.bat를 더블클릭하고 http://127.0.0.1:8766/ 에 접속하세요. PowerShell만 있으면 됩니다. 또는 Node.js 환경에서 pnpm dev / pnpm start로 실행합니다.

localhost는 해당 PC 전용 주소입니다. 학생 휴대폰에 전달할 개인 링크는 배포된 HTTPS 주소의 관리자 화면에서 발급하세요. DB 연결에는 인터넷이 필요합니다.

## 구조

- web/index.html, style.css, app.js: 화면과 동작
- web/domain.js: 한국 시간·월 경계·통계·HTML 출력 이스케이프
- web/vendor/: 버전 고정 라이브러리의 로컬 번들
- web/config.js: Supabase URL·공개 키만 포함. 관리 비밀키 금지
- web/pdf.js, fonts/: 브라우저 안에서 승인 리포트의 한글 PDF 생성
- supabase/migrations/: 기본 스키마·RLS와 개인 링크·학생 명부 변경
- 실행하기.bat, scripts/serve-static.*: 로컬 정적 파일 서버

학생 개인 링크는 256비트 무작위 토큰으로 구분하며 180일 만료·재발급·중지가 가능합니다. 원본 토큰은 DB에 저장하지 않고 비공개 스키마에 해시만 저장합니다. 이름만 입력해서 다른 학생 기록을 열 수 없습니다. 링크를 가진 사람은 해당 학생으로 체크할 수 있으므로 본인에게만 전달하세요. 관리자만 로그인하며 RLS와 DB 함수가 권한을 검사합니다.

오늘·미래의 미보고는 미완료로 취급하지 않습니다. 수행률·보고율은 기한 지난 과제만 집계하고, 분모가 없으면 데이터 없음으로 표시합니다. 일요일 자동 이월은 없습니다.

## 배포

web/의 완성 파일을 정적 호스팅에 올리면 됩니다. 현재 테스트 주소는 Vercel에서 정적 파일만 제공하며, Next.js 함수는 없습니다. Vercel을 반드시 사용할 필요는 없습니다. Vercel을 해제하더라도 Supabase의 데이터는 별도로 유지됩니다.

현재 Vercel Hobby의 상업적 이용 제한은 HTML 버전에도 적용됩니다. 실제 학원 운영 전에는 호스팅 정책에 맞는 플랜/호스팅을 선택해야 합니다. 이번 작업에서는 유료 전환·결제를 하지 않았습니다. GitHub는 코드 저장용이며 저장소/Pages를 새로 만들지는 않았습니다.

## 개발·DB 설치

라이브러리 번들 재생성이 필요한 경우 Node.js 24와 pnpm 11.25.0 환경에서 아래를 실행합니다. 배포된 web/을 실행하기 위해 이 과정을 반복할 필요는 없습니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
# Supabase URL과 publishable key 입력
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

신규 DB는 001_initial.sql → 20261109045935_student_portal_links.sql → 20261109050829_students_without_auth_accounts.sql 순서로 적용합니다. 현재 연결된 프로젝트에는 모두 적용되어 있으므로 다시 실행하지 마세요. 코치 프로필 등록 시 id와 auth_user_id에 같은 Auth UUID를 넣고 role=coach로 설정합니다. 이후 학생은 앱에서 등록합니다.

상세 설명은 web/README.md, 배포 정보는 DEPLOYMENT.md, 검증 기록은 VERIFICATION.md를 참고하세요. 예전 Next.js 구현은 app/·components/ 및 README-next-reference.md에 참고·복구용으로 유지합니다. 필요 시 pnpm legacy:dev / legacy:build / legacy:start로 실행합니다.

## 최신 로컬 로그인·ID 관리

학생은 첫 화면에 학생 ID만 입력합니다. 시험용 ID test123은 가상학생 민준에게 연결되어 있습니다. 관리자는 이메일 입력 없이 비밀번호만 입력하며 시험용 관리자 비밀번호는 test123입니다. 비밀번호는 HTML에 저장하지 않고 Supabase Auth가 검증합니다. 내부 관리자 계정 식별자만 공개 config.js에 있습니다.

관리자 → 학생 ID 관리에서 현재 ID·상태를 확인하고 ID 생성/변경/삭제를 할 수 있습니다. ID 삭제는 접속 수단을 제거하며 학생 명부·과제·누적 기록은 남깁니다. 학생 ID는 관리자가 볼 수 있도록 비공개 DB 명부에 표시값을 저장하고, 접속 검증용 해시와 분리합니다. 익명 사용자나 학생에게 전체 ID 목록을 제공하지 않습니다.

이 변경은 로컬 web/ 파일에 적용되어 있습니다. 기존 인터넷 배포를 추가 갱신하지 않았습니다. file://로 직접 열지 말고 실행하기.bat 또는 http://127.0.0.1:8766/ 으로 확인하세요. 기존 안내의 학생 개인 링크는 호환 경로로만 남기고 기본 화면에서는 사용하지 않습니다.

시험용 간단 ID/비밀번호 설정은 가상 데이터용입니다.
