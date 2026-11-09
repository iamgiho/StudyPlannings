# HTML 정적 배포 정보

- 접속: https://onplan-coaching-three.vercel.app/
- Vercel 프로젝트: giholee00-9460/onplan-coaching
- 최종 정적 배포: dpl_3NyBKNv8V2F49csq9xnKCwBCtoEc / READY / production
- 배포 소스: web/ 폴더. framework=null, build/install 생략. Next.js 서버 함수 없음.
- Supabase: jkpiuzlhvurbkbxyjdzh. 기존 기록·RLS 유지, 학생 링크와 계정 없는 명부 등록 추가.
- GitHub 저장소는 아직 없음. Vercel CLI로 정적 파일 업로드.

현재 주소는 Vercel을 이용하지만 완성된 web/ 폴더는 일반 정적 호스팅이나 로컬 서버로 옮길 수 있습니다. Vercel을 해제하는 작업은 하지 않았고 유료 플랜으로 전환하지 않았습니다. Hobby 상업 이용 제한은 여전히 적용됩니다.

관리자 계정은 planner-demo0@example.com, 비밀번호는 .env.demo.local에서 확인합니다. 학생은 관리자 화면에서 이름·학년 등록 후 링크를 발급합니다. 학생용 Auth 계정/비밀번호는 필요하지 않습니다. 기존 가상 학생 Auth 계정은 복구용으로 유지했습니다.

업데이트 배포 전 web/.vercel/project.json의 프로젝트와 소유자를 검사하세요. 정적 web/ 폴더에서 Vercel CLI deploy --prod --skip-domain으로 배포·확인한 뒤 promote합니다. 보호된 배포 검증 때문에 자동화 키를 새로 만들지 않았습니다. 기존 자동 생성 배포 URL 보호는 유지합니다.

학생 링크는 배포된 HTTPS 관리자 화면에서 발급하세요. localhost에서 발급한 링크는 해당 PC에서만 열립니다. 링크의 원본은 DB에 남지 않으며 재발급 시 이전 링크는 중지됩니다. 신규 학생은 리포트 기본 비공개입니다.
