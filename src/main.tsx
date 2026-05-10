import { FormEvent, ReactNode, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Lang = 'en' | 'mn';
type Role = 'member' | 'project_lead' | 'admin';
type User = {
  id: number;
  username: string;
  login_email: string;
  role: Role;
  display_name: string;
  force_password_change: boolean;
};

const EMAIL = 'partnership@idea.org.mn';
const SITE = 'idea.org.mn';
const MN_NAME = 'Хиймэл оюуны санаачлага хүрээлэн';
const EN_NAME = 'IDEA — Institute for Development of Ethical AI';

const i18n = {
  en: {
    org: EN_NAME,
    nav: ['Home', 'About', 'Research', 'Services', 'Partnerships', 'Contact'],
    login: 'Login',
    memberLogin: 'Member Login',
    adminLogin: 'Admin Login',
    usernameEmail: 'Username or Email',
    password: 'Password',
    signIn: 'Sign In',
    forgot: 'Forgot password?',
    notMember: 'Not a member yet?',
    notMemberText:
      'Apply to become an IDEA member. Your application will be reviewed by the administrator before your account is activated.',
    applyButton: 'Apply for Membership',
    applyTitle: 'Apply for IDEA Membership',
    applyDescription:
      'Please complete this short form to apply for IDEA membership. The administrator will review your request before activating your account.',
    submitted: 'Your membership application has been submitted. The administrator will review your request.',
    heroTitle: 'Institute for Development of Ethical AI',
    heroSubtitle:
      'Advancing responsible artificial intelligence, digital governance, cybersecurity, and emerging technology policy in Mongolia and beyond.',
    explore: 'Explore Our Work',
    partner: 'Partner With Us',
    aboutTitle: 'About IDEA',
    aboutText:
      'IDEA is an independent research and policy institute dedicated to the responsible development and ethical use of artificial intelligence and emerging technologies. The institute supports public institutions, private sector innovators, academic partners, and international organizations through research, advisory work, training, and technology evaluation.',
    researchTitle: 'Research Focus',
    servicesTitle: 'Services',
    partnershipsTitle: 'Partnerships',
    partnershipsText:
      'IDEA works with public institutions, academic partners, private sector innovators, and international organizations to support responsible technology adoption and evidence-based policy development.',
    coordinationTitle: 'International Coordination',
    coordinationNote:
      'For international meetings, IDEA coordinates schedules across Mongolia, Europe, and North America.',
    contactTitle: 'Contact',
    contactText: 'For partnership, research, training, and cooperation inquiries, please contact us.',
    protectedTeaser: 'Research Partnerships are available to registered IDEA members.',
    memberWelcome:
      'Welcome to the IDEA member area. This section provides access to institute updates, research partnerships, research collaboration, member profiles, and cooperation resources.',
    changePassword: 'Change Password',
    newPassword: 'New Password',
    save: 'Save',
    signOut: 'Sign Out',
    memberNav: [
      ['Dashboard', '/member'],
      ['My Profile', '/member/profile'],
      ['My Email', '/member/email'],
      ['Research Partnerships', '/member/research-partnerships'],
      ['Research Collaboration', '/member/research-collaboration'],
      ['Member Profiles', '/member/profiles'],
      ['Support Requests', '/member/support'],
    ],
    adminNav: [
      ['Analytics', '/admin/analytics'],
      ['Members', '/admin/members'],
      ['Membership Applications', '/admin/membership-applications'],
      ['Email Accounts', '/admin/email-accounts'],
      ['Research Partnerships', '/admin/research-partnerships'],
      ['Research Projects', '/admin/research-projects'],
      ['Member Profiles', '/admin/member-profiles'],
      ['Support Requests', '/admin/support-requests'],
      ['Audit Logs', '/admin/audit-logs'],
    ],
    profile: 'My Profile',
    myEmail: 'My Email',
    researchPartnerships: 'Research Partnerships',
    researchPartnershipsDescription:
      'This section provides member-only information on potential research cooperation, international outreach, project concepts, institutional collaboration, and technology evaluation opportunities.',
    collaboration: 'Research Collaboration',
    myProjects: 'My Research Projects',
    newProposal: 'New Research Proposal',
    projectTeam: 'Project Team',
    tasks: 'Tasks',
    materials: 'Materials',
    discussion: 'Discussion',
    updates: 'Progress Updates',
    supportRequests: 'Support Requests',
    submit: 'Submit',
    analytics: 'Visitor Analytics',
    fullName: 'Full name',
    email: 'Email address',
    phone: 'Phone number',
    organization: 'Organization or affiliation',
    position: 'Position or role',
    researchInterests: 'Research interests',
    reason: 'Reason for joining IDEA',
    requestedUsername: 'Preferred IDEA email username',
    shortBio: 'Short bio',
    expertise: 'Area of expertise',
    profileUrl: 'Website or professional profile link',
    documentLink: 'Supporting document link',
    documentHelp:
      'You may upload a CV, short profile, certificate, or other relevant document if you want to support your application. This is optional.',
    consentAccuracy: 'I confirm that the information I provided is accurate.',
    consentApproval: 'I understand that my account will be activated only after administrator approval.',
    applications: 'Membership Applications',
    applicant: 'Applicant',
    requestedEmail: 'Requested IDEA Email',
    status: 'Status',
    actions: 'Actions',
    approve: 'Approve',
    reject: 'Reject',
    moreInfo: 'Request more information',
    onboarding: 'Onboarding text',
    tempPassword: 'Temporary password',
    createMember: 'Create Member',
  },
  mn: {
    org: `IDEA — ${MN_NAME}`,
    nav: ['Нүүр', 'Бидний тухай', 'Судалгаа', 'Үйлчилгээ', 'Түншлэл', 'Холбоо барих'],
    login: 'Нэвтрэх',
    memberLogin: 'Гишүүний нэвтрэлт',
    adminLogin: 'Админы нэвтрэлт',
    usernameEmail: 'Хэрэглэгчийн нэр эсвэл имэйл',
    password: 'Нууц үг',
    signIn: 'Нэвтрэх',
    forgot: 'Нууц үг мартсан уу?',
    notMember: 'Та гишүүн биш үү?',
    notMemberText:
      'IDEA хүрээлэнгийн гишүүнээр элсэх хүсэлтээ илгээнэ үү. Таны хүсэлтийг админ хянаж зөвшөөрсний дараа гишүүний эрх идэвхжинэ.',
    applyButton: 'Гишүүнээр элсэх хүсэлт илгээх',
    applyTitle: 'IDEA хүрээлэнгийн гишүүнээр элсэх хүсэлт',
    applyDescription:
      'IDEA хүрээлэнгийн гишүүнээр элсэх хүсэлтээ энэхүү богино маягтаар илгээнэ үү. Админ таны хүсэлтийг хянасны дараа гишүүний эрхийг идэвхжүүлнэ.',
    submitted: 'Таны гишүүнээр элсэх хүсэлт илгээгдлээ. Админ таны хүсэлтийг хянаж шийдвэрлэнэ.',
    heroTitle: MN_NAME,
    heroSubtitle:
      'Хариуцлагатай хиймэл оюун, цахим засаглал, кибер аюулгүй байдал болон шинэ технологийн бодлогын хөгжлийг Монгол Улсад болон олон улсын түвшинд дэмжинэ.',
    explore: 'Бидний үйл ажиллагаа',
    partner: 'Хамтран ажиллах',
    aboutTitle: 'IDEA хүрээлэнгийн тухай',
    aboutText:
      'IDEA нь хиймэл оюун болон шинэ технологийг хариуцлагатай, ёс зүйтэй хөгжүүлэхэд чиглэсэн хараат бус судалгаа, бодлогын хүрээлэн юм. Тус хүрээлэн нь төрийн байгууллага, хувийн хэвшил, эрдэм шинжилгээний байгууллага болон олон улсын түншүүдэд судалгаа, бодлогын зөвлөмж, сургалт, технологийн үнэлгээний чиглэлээр дэмжлэг үзүүлнэ.',
    researchTitle: 'Судалгааны чиглэл',
    servicesTitle: 'Үйлчилгээ',
    partnershipsTitle: 'Түншлэл',
    partnershipsText:
      'IDEA хүрээлэн нь хариуцлагатай технологийн хэрэглээ, нотолгоонд суурилсан бодлогын хөгжлийг дэмжих зорилгоор төрийн байгууллага, эрдэм шинжилгээний байгууллага, хувийн хэвшил болон олон улсын байгууллагуудтай хамтран ажиллана.',
    coordinationTitle: 'Олон улсын уулзалтын цагийн зохицуулалт',
    coordinationNote:
      'IDEA хүрээлэн олон улсын уулзалт, хамтын ажиллагааны цагийг Монгол, Европ, Хойд Америкийн цагийн бүсэд нийцүүлэн зохицуулна.',
    contactTitle: 'Холбоо барих',
    contactText: 'Түншлэл, судалгаа, сургалт болон хамтын ажиллагааны санал хүсэлтээр бидэнтэй холбогдоно уу.',
    protectedTeaser: 'Судалгааны түншлэлийн мэдээлэл зөвхөн IDEA хүрээлэнгийн бүртгэлтэй гишүүдэд нээлттэй.',
    memberWelcome:
      'IDEA хүрээлэнгийн гишүүний хэсэгт тавтай морилно уу. Энэ хэсэгт хүрээлэнгийн мэдээлэл, судалгааны түншлэл, судалгааны хамтын ажиллагаа, гишүүдийн танилцуулга болон хамтын ажиллагааны эх сурвалжууд байрлана.',
    changePassword: 'Нууц үг солих',
    newPassword: 'Шинэ нууц үг',
    save: 'Хадгалах',
    signOut: 'Гарах',
    memberNav: [
      ['Хяналтын самбар', '/member'],
      ['Миний мэдээлэл', '/member/profile'],
      ['Миний имэйл', '/member/email'],
      ['Судалгааны түншлэл', '/member/research-partnerships'],
      ['Судалгааны хамтын ажиллагаа', '/member/research-collaboration'],
      ['Гишүүдийн танилцуулга', '/member/profiles'],
      ['Тусламжийн хүсэлт', '/member/support'],
    ],
    adminNav: [
      ['Статистик', '/admin/analytics'],
      ['Гишүүд', '/admin/members'],
      ['Гишүүнээр элсэх хүсэлтүүд', '/admin/membership-applications'],
      ['Имэйл хаягууд', '/admin/email-accounts'],
      ['Судалгааны түншлэл', '/admin/research-partnerships'],
      ['Судалгааны төслүүд', '/admin/research-projects'],
      ['Гишүүдийн танилцуулга', '/admin/member-profiles'],
      ['Тусламжийн хүсэлт', '/admin/support-requests'],
      ['Аудит бүртгэл', '/admin/audit-logs'],
    ],
    profile: 'Миний мэдээлэл',
    myEmail: 'Миний имэйл',
    researchPartnerships: 'Судалгааны түншлэл',
    researchPartnershipsDescription:
      'Энэ хэсэгт судалгааны хамтын ажиллагаа, олон улсын харилцаа, төслийн санаачилга, байгууллага хоорондын хамтын ажиллагаа, технологийн үнэлгээний боломжуудын талаарх гишүүдэд зориулсан мэдээлэл байрлана.',
    collaboration: 'Судалгааны хамтын ажиллагаа',
    myProjects: 'Миний судалгааны төслүүд',
    newProposal: 'Шинэ судалгааны санал',
    projectTeam: 'Судалгааны баг',
    tasks: 'Даалгавар',
    materials: 'Материал',
    discussion: 'Хэлэлцүүлэг',
    updates: 'Явцын мэдээлэл',
    supportRequests: 'Тусламжийн хүсэлт',
    submit: 'Илгээх',
    analytics: 'Зочлолтын статистик',
    fullName: 'Овог, нэр',
    email: 'Имэйл хаяг',
    phone: 'Утасны дугаар',
    organization: 'Байгууллага эсвэл харьяалал',
    position: 'Албан тушаал эсвэл үүрэг',
    researchInterests: 'Судалгааны сонирхол',
    reason: 'IDEA-д гишүүнээр элсэх үндэслэл',
    requestedUsername: 'IDEA имэйлд авах хүссэн нэр',
    shortBio: 'Товч танилцуулга',
    expertise: 'Мэргэшсэн чиглэл',
    profileUrl: 'Вебсайт эсвэл мэргэжлийн танилцуулгын холбоос',
    documentLink: 'Нэмэлт баталгаажуулах баримтын холбоос',
    documentHelp:
      'Та хүсвэл намтар, товч танилцуулга, гэрчилгээ эсвэл холбогдох бусад баримт хавсаргаж болно. Энэ нь заавал биш.',
    consentAccuracy: 'Миний оруулсан мэдээлэл үнэн зөв болохыг баталж байна.',
    consentApproval: 'Админ зөвшөөрсний дараа гишүүний эрх идэвхжихийг ойлгож байна.',
    applications: 'Гишүүнээр элсэх хүсэлтүүд',
    applicant: 'Хүсэлт гаргагч',
    requestedEmail: 'Хүссэн IDEA имэйл',
    status: 'Төлөв',
    actions: 'Үйлдэл',
    approve: 'Зөвшөөрөх',
    reject: 'Татгалзах',
    moreInfo: 'Нэмэлт мэдээлэл шаардах',
    onboarding: 'Шинэ гишүүнд илгээх текст',
    tempPassword: 'Түр нууц үг',
    createMember: 'Гишүүн үүсгэх',
  },
} as const;

const researchCards = [
  ['Ethical AI and Governance', 'Ёс зүйт хиймэл оюун ба засаглал'],
  ['Cybersecurity and Digital Resilience', 'Кибер аюулгүй байдал ба цахим тэсвэржилт'],
  ['Digital Transformation', 'Цахим шилжилт'],
  ['Security and Emerging Technologies', 'Аюулгүй байдал ба шинэ технологи'],
  ['AI Policy and Regulation', 'Хиймэл оюуны бодлого ба зохицуулалт'],
  ['Education and Capacity Building', 'Сургалт ба чадавх бэхжүүлэх'],
];

const serviceCards = [
  ['Policy Research and Advisory', 'Бодлогын судалгаа, зөвлөмж'],
  ['AI Readiness Assessment', 'Хиймэл оюуны бэлэн байдлын үнэлгээ'],
  ['Cybersecurity Risk Assessment', 'Кибер аюулгүй байдлын эрсдэлийн үнэлгээ'],
  ['Training and Workshops', 'Сургалт, семинар'],
  ['International Cooperation', 'Олон улсын хамтын ажиллагаа'],
  ['Pilot Projects and Technology Evaluation', 'Туршилтын төсөл ба технологийн үнэлгээ'],
];

const protectedCards = [
  ['International Research Cooperation', 'Олон улсын судалгааны хамтын ажиллагаа'],
  ['AI Policy and Governance Projects', 'Хиймэл оюуны бодлого, засаглалын төслүүд'],
  ['Cybersecurity and Digital Resilience Projects', 'Кибер аюулгүй байдал, цахим тэсвэржилтийн төслүүд'],
  ['Border, Security, and Emerging Technology Cooperation', 'Хил, аюулгүй байдал, шинэ технологийн хамтын ажиллагаа'],
  ['Training and Capacity Building Partnerships', 'Сургалт, чадавх бэхжүүлэх түншлэл'],
  ['Technology Pilot and Evaluation Opportunities', 'Технологийн туршилт, үнэлгээний боломж'],
];

const countries = [
  ['France', 'Франц', 'Research and policy cooperation', 'Судалгаа, бодлогын хамтын ажиллагаа'],
  ['Poland', 'Польш', 'Technology and security cooperation', 'Технологи, аюулгүй байдлын хамтын ажиллагаа'],
  ['United States', 'АНУ', 'AI governance and innovation cooperation', 'Хиймэл оюуны засаглал, инновацын хамтын ажиллагаа'],
];

const timeZones = [
  'Ulaanbaatar, Mongolia — UTC+8',
  'Paris, France — CET/CEST',
  'Warsaw, Poland — CET/CEST',
  'Washington, D.C., United States — Eastern Time',
  'New York, United States — Eastern Time',
];

const supportTypes = {
  en: ['Email password reset', 'Email not working', 'Webmail access issue', 'Profile update issue', 'Research partnership access issue', 'Research collaboration access issue', 'Other'],
  mn: ['Имэйлийн нууц үг сэргээх', 'Имэйл ажиллахгүй байна', 'Webmail нэвтрэх асуудал', 'Танилцуулга шинэчлэх асуудал', 'Судалгааны түншлэлийн хандалтын асуудал', 'Судалгааны хамтын ажиллагааны хандалтын асуудал', 'Бусад'],
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function useRoute() {
  const [route, setRoute] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return route;
}

function pathOnly(route: string) {
  return route.split('?')[0];
}

function LinkButton({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={to} onClick={(event) => { event.preventDefault(); navigate(to); }}>
      {children}
    </a>
  );
}

function Icon({ name }: { name: string }) {
  const d =
    name === 'shield'
      ? 'M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Zm0 4 3.5 1.5V11c0 2.4-1.3 4.7-3.5 6-2.2-1.3-3.5-3.6-3.5-6V8.5L12 7Z'
      : name === 'mail'
        ? 'M3 6h18v12H3V6Zm2.2 2 6.8 4.7L18.8 8H5.2Z'
        : 'M4 5h7v6H4V5Zm9 0h7v4h-7V5ZM4 13h7v6H4v-6Zm9-2h7v8h-7v-8Z';
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

function Header({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  const t = i18n[lang];
  const paths = ['/', '/about', '/research', '/services', '/partnerships', '/contact'];
  return (
    <header className="site-header">
      <LinkButton to="/" className="brand">
        <span className="brand-mark">I</span>
        <span><strong>IDEA</strong><small>{lang === 'en' ? 'Institute for Development of Ethical AI' : MN_NAME}</small></span>
      </LinkButton>
      <nav className="nav" aria-label="Primary navigation">
        {t.nav.map((label, index) => <LinkButton key={label} to={paths[index]}>{label}</LinkButton>)}
        <LinkButton to="/login" className="nav-cta">{t.login}</LinkButton>
        <button className="language-toggle" onClick={() => setLang(lang === 'en' ? 'mn' : 'en')} type="button">EN / MN</button>
      </nav>
    </header>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return <div className="section-heading"><span className="section-kicker">{kicker}</span><h2>{title}</h2></div>;
}

function CardGrid({ cards, icon }: { cards: string[]; icon: string }) {
  return <div className="card-grid">{cards.map((card) => <article className="info-card" key={card}><Icon name={icon} /><h3>{card}</h3></article>)}</div>;
}

function PublicSite({ lang, user }: { lang: Lang; user: User | null }) {
  const t = i18n[lang];
  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">{SITE}</div>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroSubtitle}</p>
            <div className="hero-actions">
              <LinkButton className="button button-primary" to="/research">{t.explore}</LinkButton>
              <a className="button button-secondary" href={`mailto:${EMAIL}`}>{t.partner}</a>
            </div>
          </div>
          <div className="network-visual" aria-label="Abstract AI governance visual"><span /><span /><span /><span /><div className="network-core">AI</div></div>
        </div>
      </section>
      <section className="section" id="about"><SectionHeading kicker={t.nav[1]} title={t.aboutTitle} /><p className="lead">{t.aboutText}</p></section>
      <section className="section section-tinted" id="research"><SectionHeading kicker={t.nav[2]} title={t.researchTitle} /><CardGrid cards={researchCards.map((item) => item[lang === 'en' ? 0 : 1])} icon="shield" /></section>
      <section className="section" id="services"><SectionHeading kicker={t.nav[3]} title={t.servicesTitle} /><CardGrid cards={serviceCards.map((item) => item[lang === 'en' ? 0 : 1])} icon="project" /></section>
      <section className="section section-navy" id="partnerships">
        <SectionHeading kicker={t.nav[4]} title={t.partnershipsTitle} />
        <p className="lead light">{t.partnershipsText}</p>
        <div className="country-grid">{countries.map(([enName, mnName, enText, mnText]) => <article className="country-card" key={enName}><div className="pin" /><strong>{lang === 'en' ? enName : mnName}</strong><span>{lang === 'en' ? enText : mnText}</span></article>)}</div>
        <div className="timezone-panel"><h3>{t.coordinationTitle}</h3><p>{t.coordinationNote}</p><ul>{timeZones.map((zone) => <li key={zone}>{zone}</li>)}</ul></div>
      </section>
      {!user && <section className="section teaser"><p>{t.protectedTeaser}</p></section>}
      <section className="section" id="contact">
        <SectionHeading kicker={t.nav[5]} title={t.contactTitle} />
        <p className="lead">{t.contactText}</p>
        <div className="contact-grid">
          <InfoTile label="Email" value={EMAIL} href={`mailto:${EMAIL}`} />
          <InfoTile label="Website" value={SITE} href="https://idea.org.mn/" />
          <a className="button button-primary contact-button" href={`mailto:${EMAIL}`}>{t.partner}</a>
        </div>
      </section>
    </main>
  );
}

function InfoTile({ label, value, href }: { label: string; value: string; href: string }) {
  return <div className="info-tile"><span>{label}</span><a href={href}>{value}</a></div>;
}

function UnifiedLogin({ lang, onLogin }: { lang: Lang; onLogin: (user: User) => void }) {
  const t = i18n[lang];
  const roleFromQuery = new URLSearchParams(window.location.search).get('role') === 'admin' ? 'admin' : 'member';
  const [mode, setMode] = useState<'member' | 'admin'>(roleFromQuery);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password, role: mode }) });
      onLogin(data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/member');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied');
    }
  }

  return (
    <main className="auth-shell split-auth">
      <section className="auth-card">
        <div className="login-tabs">
          <button className={mode === 'member' ? 'active' : ''} type="button" onClick={() => setMode('member')}>{t.memberLogin}</button>
          <button className={mode === 'admin' ? 'active' : ''} type="button" onClick={() => setMode('admin')}>{t.adminLogin}</button>
        </div>
        <form onSubmit={submit} className="stack-form">
          <h1>{mode === 'admin' ? t.adminLogin : t.memberLogin}</h1>
          <label>{t.usernameEmail}<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" /></label>
          <label>{t.password}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
          {error && <p className="error">{error}</p>}
          <button className="button button-primary" type="submit">{t.signIn}</button>
          <span className="muted">{t.forgot}</span>
        </form>
      </section>
      <aside className="apply-callout">
        <h2>{t.notMember}</h2>
        <p>{t.notMemberText}</p>
        <LinkButton className="button button-primary" to="/apply">{t.applyButton}</LinkButton>
      </aside>
    </main>
  );
}

function ApplyPage({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [form, setForm] = useState<Record<string, string | boolean>>({ consent_accuracy: false, consent_approval: false });
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const requested = `${String(form.requested_email_username || '').toLowerCase().replace(/[^a-z0-9._-]/g, '')}@idea.org.mn`;
  const required = [
    ['full_name', t.fullName],
    ['email', t.email],
    ['phone', t.phone],
    ['organization', t.organization],
    ['position', t.position],
    ['research_interests', t.researchInterests],
    ['reason_for_joining', t.reason],
    ['requested_email_username', t.requestedUsername],
  ];
  const optional = [
    ['short_bio', t.shortBio],
    ['expertise_area', t.expertise],
    ['professional_profile_url', t.profileUrl],
    ['supporting_document_path', t.documentLink],
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setDone('');
    try {
      await api('/api/membership/apply', { method: 'POST', body: JSON.stringify(form) });
      setDone(t.submitted);
      setForm({ consent_accuracy: false, consent_approval: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    }
  }

  return (
    <main className="auth-shell">
      <form className="application-form" onSubmit={submit}>
        <span className="section-kicker">{SITE}</span>
        <h1>{t.applyTitle}</h1>
        <p className="lead">{t.applyDescription}</p>
        <div className="form-grid">
          {required.map(([field, label]) => <label key={field}>{label}<input required value={String(form[field] || '')} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}
        </div>
        <div className="email-preview">{t.requestedEmail}: <strong>{requested}</strong></div>
        <div className="form-grid">
          {optional.map(([field, label]) => <label key={field}>{label}<input value={String(form[field] || '')} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}
        </div>
        <p className="muted">{t.documentHelp}</p>
        <label className="check-row"><input type="checkbox" checked={Boolean(form.consent_accuracy)} onChange={(event) => setForm({ ...form, consent_accuracy: event.target.checked })} />{t.consentAccuracy}</label>
        <label className="check-row"><input type="checkbox" checked={Boolean(form.consent_approval)} onChange={(event) => setForm({ ...form, consent_approval: event.target.checked })} />{t.consentApproval}</label>
        {error && <p className="error">{error}</p>}
        {done && <p className="success">{done}</p>}
        <button className="button button-primary" disabled={!form.consent_accuracy || !form.consent_approval}>{t.submit}</button>
      </form>
    </main>
  );
}

function ChangePassword({ lang, onChanged }: { lang: Lang; onChanged: (user: User) => void }) {
  const t = i18n[lang];
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ password }) });
      onChanged(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  return <main className="auth-shell"><form className="auth-card stack-form" onSubmit={submit}><h1>{t.changePassword}</h1><label>{t.newPassword}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="button button-primary">{t.save}</button></form></main>;
}

function PortalLayout({ lang, user, nav, children, onLogout }: { lang: Lang; user: User; nav: readonly (readonly [string, string])[]; children: ReactNode; onLogout: () => void }) {
  const t = i18n[lang];
  return (
    <main className="portal">
      <aside className="portal-sidebar">
        <div className="portal-user"><div className="avatar">{user.display_name.slice(0, 1)}</div><strong>{user.display_name}</strong><span>{user.role}</span></div>
        <nav>{nav.map(([label, path]) => <LinkButton key={path} to={path}>{label}</LinkButton>)}<button onClick={onLogout} type="button">{t.signOut}</button></nav>
      </aside>
      <section className="portal-content">{children}</section>
    </main>
  );
}

function MemberPortal({ lang, route, user, setUser }: { lang: Lang; route: string; user: User; setUser: (user: User | null) => void }) {
  const t = i18n[lang];
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); setUser(null); navigate('/'); }
  const path = pathOnly(route);
  return (
    <PortalLayout lang={lang} user={user} nav={t.memberNav} onLogout={logout}>
      {path === '/member/profile' && <ProfilePanel lang={lang} />}
      {path === '/member/email' && <EmailPanel lang={lang} />}
      {path === '/member/research-partnerships' && <ProtectedPartnerships lang={lang} />}
      {(path.startsWith('/member/research-collaboration') || path.startsWith('/member/research-projects')) && <ResearchHub lang={lang} admin={false} />}
      {path === '/member/profiles' && <MemberProfiles lang={lang} />}
      {path === '/member/support' && <SupportPanel lang={lang} />}
      {path === '/member' && <Dashboard lang={lang} />}
    </PortalLayout>
  );
}

function Dashboard({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  return <><h1>{t.memberNav[0][0]}</h1><p className="lead">{t.memberWelcome}</p><div className="dashboard-grid">{[t.profile, t.myEmail, t.researchPartnerships, t.collaboration, t.supportRequests].map((item) => <article className="dash-card" key={item}><Icon name="project" /><strong>{item}</strong></article>)}</div></>;
}

function ProfilePanel({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const labels = lang === 'en'
    ? { position: 'Position', organization: 'Organization', phone: 'Phone', bio: 'Bio', photo_url: 'Profile photo URL', visibility: 'Visibility' }
    : { position: 'Албан тушаал', organization: 'Байгууллага', phone: 'Утас', bio: 'Танилцуулга', photo_url: 'Зургийн URL', visibility: 'Харагдах байдал' };
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  useEffect(() => { api('/api/member/profile').then((data) => setProfile(data.profile || {})); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api('/api/member/profile', { method: 'PUT', body: JSON.stringify(profile) });
    setSaved(lang === 'en' ? 'Saved' : 'Хадгаллаа');
  }
  return <form className="panel-form" onSubmit={submit}><h1>{t.profile}</h1>{['position', 'organization', 'phone', 'bio', 'photo_url'].map((field) => <label key={field}>{labels[field as keyof typeof labels]}<input value={profile[field] || ''} onChange={(event) => setProfile({ ...profile, [field]: event.target.value })} /></label>)}<label>{labels.visibility}<select value={profile.visibility || 'members_only'} onChange={(event) => setProfile({ ...profile, visibility: event.target.value })}><option value="private">private</option><option value="members_only">members_only</option><option value="public">public</option></select></label><button className="button button-primary">{t.save}</button>{saved && <span className="success">{saved}</span>}</form>;
}

function EmailPanel({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [data, setData] = useState<any>({});
  useEffect(() => { api('/api/member/email').then(setData); }, []);
  const email = data.email || {};
  const statuses: Record<string, string[]> = { not_assigned: ['Not assigned', 'Оноогоогүй'], pending_setup: ['Pending setup', 'Тохируулах шатанд'], active: ['Active', 'Идэвхтэй'], suspended: ['Suspended', 'Түр хаасан'] };
  return <><h1>{t.myEmail}</h1><div className="detail-grid"><InfoTile label={lang === 'en' ? 'IDEA email address' : 'IDEA имэйл хаяг'} value={email.email_address || 'not_assigned'} href={`mailto:${email.email_address || EMAIL}`} /><div className="info-tile"><span>{lang === 'en' ? 'Email status' : 'Имэйлийн төлөв'}</span><strong>{statuses[email.status]?.[lang === 'en' ? 0 : 1] || email.status}</strong></div><InfoTile label={lang === 'en' ? 'Webmail URL' : 'Webmail холбоос'} value={email.webmail_url || data.webmail_url || ''} href={email.webmail_url || data.webmail_url || '#'} /></div><a className="button button-primary" href={email.webmail_url || data.webmail_url}>{lang === 'en' ? 'Open Webmail' : 'Webmail нээх'}</a></>;
}

function ProtectedPartnerships({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api('/api/member/research-partnerships').then((data) => setItems(data.items || [])); }, []);
  const fallback = protectedCards.map(([en, mn]) => ({ title_en: en, title_mn: mn }));
  return <><h1>{t.researchPartnerships}</h1><p className="lead">{t.researchPartnershipsDescription}</p><div className="card-grid">{(items.length ? items : fallback).map((item) => <article className="info-card" key={item.id || item.title_en}><Icon name="project" /><h3>{lang === 'en' ? item.title_en : item.title_mn}</h3></article>)}</div></>;
}

function MemberProfiles({ lang }: { lang: Lang }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  useEffect(() => { api('/api/member/member-profiles').then((data) => setProfiles(data.profiles || [])); }, []);
  return <><h1>{i18n[lang].memberNav[5][0]}</h1><div className="profile-grid">{profiles.map((profile) => <article className="profile-card" key={profile.id}><div className="avatar">{profile.display_name?.slice(0, 1)}</div><h3>{profile.display_name}</h3><p>{profile.position}</p><p>{profile.organization}</p><p>{profile.bio}</p><a href={`mailto:${profile.email_address}`}>{profile.email_address}</a></article>)}</div></>;
}

function SupportPanel({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [requestType, setRequestType] = useState(supportTypes[lang][0]);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api('/api/member/support-request', { method: 'POST', body: JSON.stringify({ request_type: requestType, message }) });
    setMessage('');
    setDone(lang === 'en' ? 'Submitted' : 'Илгээгдлээ');
  }
  return <form className="panel-form" onSubmit={submit}><h1>{t.supportRequests}</h1><label>{lang === 'en' ? 'Request Type' : 'Хүсэлтийн төрөл'}<select value={requestType} onChange={(event) => setRequestType(event.target.value)}>{supportTypes[lang].map((item) => <option key={item}>{item}</option>)}</select></label><label>{lang === 'en' ? 'Message' : 'Мессеж'}<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label><button className="button button-primary">{t.submit}</button>{done && <span className="success">{done}</span>}</form>;
}

function ResearchHub({ lang, admin }: { lang: Lang; admin: boolean }) {
  const t = i18n[lang];
  const [projects, setProjects] = useState<any[]>([]);
  const [form, setForm] = useState({ title_en: '', title_mn: '', summary_en: '', summary_mn: '', status: 'idea', visibility: 'team_only' });
  const endpoint = admin ? '/api/admin/research-projects' : '/api/member/research-projects';
  useEffect(() => { api(endpoint).then((data) => setProjects(data.projects || [])); }, [endpoint]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api(endpoint, { method: 'POST', body: JSON.stringify(form) });
    const data = await api(endpoint);
    setProjects(data.projects || []);
  }
  return <><h1>{t.collaboration}</h1><div className="split"><section><h2>{t.myProjects}</h2><div className="project-list">{projects.map((project) => <article className="project-card" key={project.id}><span>{project.status}</span><h3>{lang === 'en' ? project.title_en : project.title_mn}</h3><p>{lang === 'en' ? project.summary_en : project.summary_mn}</p><div className="mini-tabs"><span>{t.projectTeam}</span><span>{t.tasks}</span><span>{t.materials}</span><span>{t.discussion}</span><span>{t.updates}</span></div></article>)}</div></section><form className="panel-form" onSubmit={submit}><h2>{t.newProposal}</h2><label>Title EN<input value={form.title_en} onChange={(event) => setForm({ ...form, title_en: event.target.value })} /></label><label>Title MN<input value={form.title_mn} onChange={(event) => setForm({ ...form, title_mn: event.target.value })} /></label><label>Summary EN<textarea value={form.summary_en} onChange={(event) => setForm({ ...form, summary_en: event.target.value })} /></label><label>Summary MN<textarea value={form.summary_mn} onChange={(event) => setForm({ ...form, summary_mn: event.target.value })} /></label><button className="button button-primary">{t.submit}</button></form></div></>;
}

function AdminPortal({ lang, route, user, setUser }: { lang: Lang; route: string; user: User; setUser: (user: User | null) => void }) {
  const t = i18n[lang];
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); setUser(null); navigate('/'); }
  const path = pathOnly(route);
  return (
    <PortalLayout lang={lang} user={user} nav={t.adminNav} onLogout={logout}>
      {(path === '/admin' || path === '/admin/analytics') && <AnalyticsPanel lang={lang} />}
      {path === '/admin/members' && <AdminMembers lang={lang} />}
      {path === '/admin/membership-applications' && <MembershipApplications lang={lang} />}
      {path === '/admin/email-accounts' && <AdminTable title={t.adminNav[3][0]} endpoint="/api/admin/email-accounts" keyName="accounts" />}
      {path === '/admin/research-partnerships' && <AdminTable title={t.adminNav[4][0]} endpoint="/api/admin/research-partnerships" keyName="items" />}
      {path.startsWith('/admin/research-projects') && <ResearchHub lang={lang} admin />}
      {path === '/admin/member-profiles' && <AdminTable title={t.adminNav[6][0]} endpoint="/api/admin/member-profiles" keyName="profiles" />}
      {path === '/admin/support-requests' && <AdminTable title={t.adminNav[7][0]} endpoint="/api/admin/support-requests" keyName="requests" />}
      {path === '/admin/audit-logs' && <AdminTable title={t.adminNav[8][0]} endpoint="/api/admin/audit-logs" keyName="logs" />}
    </PortalLayout>
  );
}

function MembershipApplications({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [apps, setApps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [approval, setApproval] = useState<Record<string, string>>({ role: 'member', email_status: 'pending_setup' });
  const [onboarding, setOnboarding] = useState('');
  async function load() { const data = await api('/api/admin/membership-applications'); setApps(data.applications || []); }
  useEffect(() => { load(); }, []);
  async function selectApp(id: number) {
    const data = await api(`/api/admin/membership-applications/${id}`);
    const app = data.application;
    setSelected(app);
    setApproval({ username: app.requested_email_username, display_name: app.full_name, login_email: app.email, idea_email: app.requested_idea_email, role: 'member', email_status: 'pending_setup', temporary_password: '' });
    setOnboarding('');
  }
  async function approve() {
    const data = await api(`/api/admin/membership-applications/${selected.id}/approve`, { method: 'POST', body: JSON.stringify(approval) });
    setOnboarding(data.onboarding?.[lang] || '');
    await load();
  }
  async function status(endpoint: string) {
    await api(`/api/admin/membership-applications/${selected.id}/${endpoint}`, { method: 'POST', body: JSON.stringify({ admin_notes: approval.admin_notes || '' }) });
    await load();
    setSelected(null);
  }
  return (
    <div className="split">
      <section>
        <h1>{t.applications}</h1>
        <div className="table-panel"><div className="table-scroll"><table><thead><tr><th>{t.applicant}</th><th>{t.email}</th><th>{t.organization}</th><th>{t.requestedEmail}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead><tbody>{apps.map((app) => <tr key={app.id}><td>{app.full_name}</td><td>{app.email}</td><td>{app.organization}</td><td>{app.requested_idea_email}</td><td>{app.status}</td><td><button className="small-button" onClick={() => selectApp(app.id)}>{lang === 'en' ? 'View' : 'Харах'}</button></td></tr>)}</tbody></table></div></div>
      </section>
      {selected && <form className="panel-form" onSubmit={(event) => { event.preventDefault(); approve(); }}>
        <h2>{selected.full_name}</h2>
        <p>{selected.reason_for_joining}</p>
        {['username', 'display_name', 'login_email', 'idea_email', 'temporary_password'].map((field) => <label key={field}>{field === 'temporary_password' ? t.tempPassword : field}<input value={approval[field] || ''} onChange={(event) => setApproval({ ...approval, [field]: event.target.value })} /></label>)}
        <label>Role<select value={approval.role} onChange={(event) => setApproval({ ...approval, role: event.target.value })}><option>member</option><option>project_lead</option><option>admin</option></select></label>
        <label>Email status<select value={approval.email_status} onChange={(event) => setApproval({ ...approval, email_status: event.target.value })}><option>pending_setup</option><option>active</option><option>not_assigned</option><option>suspended</option></select></label>
        <label>Admin note<textarea value={approval.admin_notes || ''} onChange={(event) => setApproval({ ...approval, admin_notes: event.target.value })} /></label>
        <button className="button button-primary">{t.approve}</button>
        <button className="button subtle" type="button" onClick={() => status('reject')}>{t.reject}</button>
        <button className="button subtle" type="button" onClick={() => status('request-more-info')}>{t.moreInfo}</button>
        {onboarding && <label>{t.onboarding}<textarea readOnly value={onboarding} /></label>}
      </form>}
    </div>
  );
}

function AnalyticsPanel({ lang }: { lang: Lang }) {
  const [summary, setSummary] = useState<any>({});
  const [pages, setPages] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => { api('/api/admin/analytics/summary').then(setSummary); api('/api/admin/analytics/top-pages').then((data) => setPages(data.rows || [])); api('/api/admin/analytics/recent-visits').then((data) => setRecent(data.rows || [])); }, []);
  return <><h1>{i18n[lang].analytics}</h1><div className="stats-grid"><Stat label="Total visits" value={summary.total} /><Stat label="Visits today" value={summary.today} /><Stat label="Unique visitors today" value={summary.uniqueToday} /><Stat label="Visits this month" value={summary.month} /></div><div className="split"><SimpleTable title="Top pages" rows={pages} /><SimpleTable title="Recent visits" rows={recent} /></div></>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <article className="stat-card"><span>{label}</span><strong>{value ?? 0}</strong></article>;
}

function AdminMembers({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ username: '', login_email: '', display_name: '', role: 'member', idea_email: '', password: '' });
  useEffect(() => { api('/api/admin/members').then((data) => setMembers(data.members || [])); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api('/api/admin/members', { method: 'POST', body: JSON.stringify(form) });
    const data = await api('/api/admin/members');
    setMembers(data.members || []);
  }
  return <div className="split"><section><h1>{t.adminNav[1][0]}</h1><SimpleTable title={t.adminNav[1][0]} rows={members} /></section><form className="panel-form" onSubmit={submit}><h2>{t.createMember}</h2>{(['username', 'login_email', 'display_name', 'idea_email', 'password'] as const).map((field) => <label key={field}>{field}<input type={field === 'password' ? 'password' : 'text'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}<label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>member</option><option>project_lead</option><option>admin</option></select></label><button className="button button-primary">{t.save}</button></form></div>;
}

function AdminTable({ title, endpoint, keyName }: { title: string; endpoint: string; keyName: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api(endpoint).then((data) => setRows(data[keyName] || [])); }, [endpoint, keyName]);
  return <SimpleTable title={title} rows={rows} />;
}

function SimpleTable({ title, rows }: { title: string; rows: any[] }) {
  const keys = useMemo(() => Object.keys(rows[0] || {}).slice(0, 6), [rows]);
  return <section className="table-panel"><h2>{title}</h2><div className="table-scroll"><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{keys.map((key) => <td key={key}>{String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div></section>;
}

function Footer({ lang }: { lang: Lang }) {
  return <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">I</span><div><strong>{i18n[lang].org}</strong><p>{SITE}</p></div></div><div className="footer-links"><a href="https://idea.org.mn/">{SITE}</a><a href={`mailto:${EMAIL}`}>{EMAIL}</a></div></footer>;
}

function App() {
  const route = useRoute();
  const path = pathOnly(route);
  const [lang, setLangState] = useState<Lang>((localStorage.getItem('idea_lang') as Lang) || 'en');
  const [user, setUser] = useState<User | null>(null);

  function setLang(next: Lang) {
    localStorage.setItem('idea_lang', next);
    setLangState(next);
  }

  useEffect(() => { api('/api/auth/me').then((data) => setUser(data.user)).catch(() => setUser(null)); }, []);

  useEffect(() => {
    if (path === '/member-login') navigate('/login?role=member');
    if (path === '/admin-login') navigate('/login?role=admin');
  }, [path]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'IDEA — Institute for Development of Ethical AI' : `IDEA — ${MN_NAME}`;
    const params = new URLSearchParams(window.location.search);
    api('/api/track', { method: 'POST', body: JSON.stringify({ path, page_title: document.title, language: lang.toUpperCase(), referrer: document.referrer, utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '', utm_campaign: params.get('utm_campaign') || '' }) }).catch(() => undefined);
  }, [path, lang]);

  if (user?.force_password_change) return <ChangePassword lang={lang} onChanged={setUser} />;

  const isAdminRoute = path.startsWith('/admin');
  const isMemberRoute = path.startsWith('/member') && path !== '/member-login';

  return (
    <>
      <Header lang={lang} setLang={setLang} />
      {path === '/login' && <UnifiedLogin lang={lang} onLogin={setUser} />}
      {path === '/apply' && <ApplyPage lang={lang} />}
      {isMemberRoute && user && user.role !== 'admin' && <MemberPortal lang={lang} route={route} user={user} setUser={setUser} />}
      {isMemberRoute && (!user || user.role === 'admin') && <UnifiedLogin lang={lang} onLogin={setUser} />}
      {isAdminRoute && user?.role === 'admin' && <AdminPortal lang={lang} route={route} user={user} setUser={setUser} />}
      {isAdminRoute && user?.role !== 'admin' && <UnifiedLogin lang={lang} onLogin={setUser} />}
      {!isAdminRoute && !isMemberRoute && path !== '/login' && path !== '/apply' && path !== '/member-login' && path !== '/admin-login' && <PublicSite lang={lang} user={user} />}
      <Footer lang={lang} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
