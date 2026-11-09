# 온플랜 · Planner Coaching System

학생과 코치가 현실적인 계획을 함께 만들고 자기보고 수행 기록을 다음 계획에 활용하는 한국어 MVP입니다. Next.js App Router, TypeScript, Tailwind CSS, shadcn 스타일 Button, Supabase Auth/PostgreSQL/RLS를 사용합니다. 시간 추적·순위·푸시·AI 코칭·학부모 로그인·자동 발송 기능은 없습니다.

## 1. 로컬 설치

Node.js 22 이상과 pnpm 11 이상을 설치하세요. 이 개발 환경은 Node 24에서 검증했습니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

## 2. Supabase 설정

1. 새 Supabase 프로젝트를 만듭니다. 테스트는 실제 학생 정보가 없는 별도 프로젝트에서 진행하세요.
2. SQL Editor에서 `supabase/migrations/001_initial.sql` 전체를 **한 번** 실행합니다. CLI 사용 시 `supabase link --project-ref <ref>` 다음 `supabase db push`로 적용할 수 있습니다.
3. Project Settings → API에서 프로젝트 URL과 publishable key를 `.env.local`의 두 변수에 입력합니다. 이전 프로젝트의 anon key도 공개 키 용도로 사용할 수 있습니다. service_role key는 프런트엔드 환경변수에 넣지 마세요.
4. Auth 설정에서 공개 회원가입을 비활성화하고, 운영자가 사용자를 생성합니다. 앱은 임의 회원가입 및 역할 선택을 제공하지 않습니다.
5. Auth → Users에서 만든 UUID로 아래처럼 프로필 및 배정을 등록합니다. 역할·배정은 신뢰할 수 있는 운영자만 SQL Editor 또는 관리 백엔드에서 변경합니다.

```sql
insert into public.profiles(id,name,role,grade) values
 ('COACH_AUTH_UUID','가상 코치','coach',''),
 ('STUDENT_AUTH_UUID','가상 학생','student','중학교 3학년');
insert into public.coach_student_assignments(coach_id,student_id)
values ('COACH_AUTH_UUID','STUDENT_AUTH_UUID');
```

비밀번호 초기화는 MVP에서 Supabase 운영자 관리 경로로 제공합니다. 학생 이메일 외의 생년월일·전화번호·주소 등은 수집하지 않습니다. 법적 요건 확인 체크는 법률 판단을 자동화하지 않으므로 학원의 실제 개인정보 처리 및 보호자 동의 절차를 별도로 운영해야 합니다.

## 3. 가상 데이터 만들기 (선택)

새로운 **독립 데모 프로젝트**에만 실행하세요. 동일 이메일이 있으면 중단하므로 중복 실행하지 마세요. 실패한 경우 Auth Users 및 생성된 데이터를 운영자가 확인하고 정리하세요.

```powershell
$env:SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='SERVER_ONLY_SERVICE_ROLE_KEY'
$env:DEMO_PASSWORD='직접_설정하는_12자_이상_비밀번호'
$env:DEMO_SEED_CONFIRM='isolated-demo-project'
node scripts/seed.mjs
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:DEMO_PASSWORD
```

코치 `demo0@example.com`, 학생 `demo1@example.com`~`demo5@example.com` 및 이번 주 월~토 가상 과제를 만듭니다. 일요일에는 과제를 만들지 않습니다. 이 관리 키는 서버 스크립트만 사용하며 저장소·Vercel 클라이언트 변수에 등록하지 않습니다.

## 4. 실행과 사용

```powershell
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 로그인합니다. 환경변수가 없으면 설정 안내 화면이 표시됩니다. 데모 인증 우회나 localStorage 가짜 학습 데이터는 없습니다.

- **코치:** 학생 현황 → 학생의 플래너 → 주간 목표 저장 → 날짜별 과제 추가 → 코치 확정. 과제 수정에서 범위 축소·재배치·취소가 가능하며 변경 이력을 보존합니다. 주 이동으로 다음 주 계획을 작성합니다.
- **학생:** 오늘의 과제에서 완료·미완료·미보고를 눌러 바로 저장합니다. 미래 수행 체크는 DB에서 차단합니다. 주 이동으로 다음 주 계획을 볼 수 있습니다.
- **성장 단계:** 기본 1단계는 코치 공동 배분, 2단계는 학생 날짜 변경, 3단계는 학생 주간 목표·과제 초안 작성 및 편집입니다. 3단계의 확정된 계획은 코치가 수정합니다. 2단계는 제목·내용·취소를 바꿀 수 없습니다.
- **코칭 노트:** 내부 상담 필드와 학생 공개 피드백을 별도 테이블에 저장합니다. 주 이동과 지난 기록에서 이력을 확인합니다.
- **리포트:** 학생 본인이 공유 의사를 체크하고, 코치가 주간/월간 허용과 법적 요건을 확인합니다. 집계 초안 생성 → 코치 내용 편집 → 비공개 저장 또는 검토 승인 → 텍스트 복사/PDF 다운로드입니다. 내보낼 때마다 현재 동의 상태를 서버가 재검사합니다. 자동 발송 및 외부 실시간 열람 URL은 없습니다. 코치가 편집 시 비공개 메모를 수동으로 옮겨 적지 않도록 검토해야 합니다.

## 집계와 보안

- 날짜·주간 경계는 Asia/Seoul이며 주는 월~일입니다. 일요일 자동 이월은 없습니다.
- 수행률은 **기한 지난 완료 / (완료 + 미완료)**, 보고율은 **기한 지난 보고 수 / 기한 지난 전체 수**입니다. 오늘·미래·취소 과제는 이 두 비율에서 제외합니다. 분모 0은 데이터 없음입니다.
- 미보고는 미완료로 바꾸지 않습니다. 전체 계획 수에는 미래 과제가 포함되지만 과거 통계에는 포함되지 않습니다.
- 월간은 실제 배정 날짜를 기준으로 집계합니다. 리포트는 월내 7일 구간 추이·과목·지난달 수행률을 제공하고, 습관 변화 및 다음 코칭 방향은 코치가 작성합니다.
- 과제별 양과 난이도가 달라 개수 기반 비율은 실제 학업 성취도가 아닙니다.
- `lib/policy.ts`의 임시 운영 규칙: 최근 14일 내 미보고 확인, 미완료 3개 이상 상담 안내. 학생의 태도나 게으름을 판정하지 않습니다.
- 모든 테이블에 RLS가 있고 클라이언트 직접 쓰기는 금지합니다. SECURITY DEFINER RPC가 인증 UUID와 배정·단계를 검사하고 동일 주 날짜 연결 및 상태 입력을 검증합니다. 역할은 클라이언트에서 변경할 수 없습니다.
- 인증은 Supabase 브라우저 클라이언트의 세션과 JWT를 사용합니다. Next 서버에는 개인 데이터가 없고 DB가 모든 접근을 승인합니다. 클라이언트 화면 숨김에 보안을 의존하지 않습니다.
- 수행 기록은 Realtime 및 15초 폴링으로 동기화합니다. 통계용 조회는 500행씩 페이지를 순회해 API의 기본 행수 제한으로 잘리는 것을 방지합니다. 변경 이력 UI는 최신 100건, 원본 전체는 DB에 보존합니다.
- 리포트는 생성 시점의 요약 스냅샷입니다. 이후 수행 기록 변경 시 새 초안을 생성하고 다시 검토하세요. 이미 전달된 파일은 동의 철회로 회수할 수 없습니다.

## 5. 검증

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

자동화 테스트는 날짜·통계 4건과 PostgreSQL(PGlite) 통합 시나리오 1건입니다. 통합 시나리오는 실제 마이그레이션을 실행하고 코치 계획 생성, 학생 조회·체크, 타학생/미배정 코치 차단, 직접 역할 변경 차단, 날짜 권한, 일요일 기본 빈 상태, 감사 기록, 내부 메모 격리, 승인 전 내보내기 차단, 공유 철회 차단을 검증합니다. PGlite 테스트에서는 Supabase Auth의 `auth.uid()`를 JWT 설정으로 모사하고 확장 설치/Realtime publication 문장만 제외합니다.

실제 Supabase Auth 로그인·WebSocket·Vercel 환경의 PDF 다운로드 검증까지 완료했습니다. 배포 전 가상 계정 2개를 서로 다른 브라우저로 로그인하고 체크 즉시 저장, 코치 동기화, 375px 모바일 터치, 공유 철회 후 PDF 차단을 직접 확인하세요. 대규모 기관을 위한 서버 집계·페이지별 조회 최적화, 계정 관리 UI, 감사로그 보존/파기 운영 정책은 후속 작업입니다.

## 6. Vercel 배포

1. 이 폴더를 Git 저장소에 커밋하고 GitHub에 푸시합니다. `.env.local`은 커밋하지 않습니다.
2. Vercel → Add New Project → 저장소 선택 → Next.js 프리셋 선택.
3. Node.js 22 이상을 선택하고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Production/Preview에 설정합니다. Preview는 독립 데모 Supabase를 사용하세요.
4. Install `pnpm install --frozen-lockfile`, Build `pnpm build`로 배포합니다. 환경변수를 바꾼 경우 다시 빌드합니다.
5. Supabase Auth → URL Configuration에서 Site URL에 배포 도메인을 등록합니다. 향후 복구/초대 리다이렉트를 추가할 때 해당 URL도 허용 목록에 등록합니다.
6. HTTPS 배포에서 가상 코치·학생으로 위 검증 시나리오를 실행한 다음 운영 계정을 배정합니다.

실제 Supabase 연결 및 Vercel 배포를 완료했습니다. 현재 접속 주소와 검증 결과는 DEPLOYMENT.md 및 VERIFICATION.md를 확인하세요.

구현 참고: [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation), [Supabase 클라이언트 및 인증](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs). 이 앱은 브라우저 인증 구조를 사용하며 SSR 쿠키 인증은 도입하지 않았습니다.

