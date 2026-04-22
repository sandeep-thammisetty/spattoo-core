import { useState, useEffect } from 'react';

const BRAND = '#9b5f72';
const BRAND_LIGHT = '#f5e6ec';
const FONT = "'Quicksand', sans-serif";

function Input({ label, type = 'text', value, onChange, disabled, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#7a4a5a', fontFamily: FONT }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: '1.5px solid #e0cdd4',
          fontSize: 14,
          fontFamily: FONT,
          outline: 'none',
          background: disabled ? '#f9f4f6' : '#fff',
          color: '#3e2010',
        }}
      />
    </label>
  );
}

function Btn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '11px 0',
        borderRadius: 8,
        border: 'none',
        background: BRAND,
        color: '#fff',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        width: '100%',
      }}
    >
      {children}
    </button>
  );
}

function Card({ title, subtitle, emoji, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: BRAND_LIGHT, fontFamily: FONT,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 32px',
        width: '100%', maxWidth: 380,
        boxShadow: '0 4px 24px rgba(155,95,114,0.12)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>{emoji}</div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 700, color: BRAND }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#a07080' }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Alert({ message, type }) {
  const styles = {
    error: { color: '#c0392b', background: '#fdf0ee' },
    info:  { color: '#2e7d52', background: '#edf7f1' },
  };
  return (
    <div style={{ fontSize: 13, borderRadius: 6, padding: '8px 12px', ...styles[type] }}>
      {message}
    </div>
  );
}

const linkStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: BRAND, fontFamily: FONT, fontWeight: 600, fontSize: 12, padding: 0,
};

// ── Auth forms (login / signup / forgot) ──────────────────────────────────────
function AuthForms({ supabase }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const reset = () => { setError(''); setInfo(''); };

  async function handleLogin() {
    setLoading(true); reset();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSignup() {
    setLoading(true); reset();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    });
    if (error) setError(error.message);
    else setInfo('Check your email to confirm your account, then sign in.');
    setLoading(false);
  }

  async function handleForgot() {
    setLoading(true); reset();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setInfo('Password reset email sent — check your inbox.');
    setLoading(false);
  }

  const titles    = { login: 'Welcome back',   signup: 'Create account', forgot: 'Reset password' };
  const subtitles = { login: 'Sign in to manage your bakery', signup: 'Set up your spattoo account', forgot: "We'll email you a reset link" };

  return (
    <Card title={titles[mode]} subtitle={subtitles[mode]} emoji="🎂">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'signup' && (
          <Input label="Full name" value={name} onChange={setName} disabled={loading} />
        )}
        <Input label="Email" type="email" value={email} onChange={setEmail} disabled={loading} />
        {mode !== 'forgot' && (
          <Input label="Password" type="password" value={password} onChange={setPassword} disabled={loading} />
        )}
      </div>

      {error && <Alert message={error} type="error" />}
      {info  && <Alert message={info}  type="info"  />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mode === 'login' && (
          <>
            <Btn onClick={handleLogin} disabled={loading || !email || !password}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Btn>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => { setMode('signup'); reset(); }} style={linkStyle}>Create account</button>
              <button onClick={() => { setMode('forgot'); reset(); }} style={linkStyle}>Forgot password?</button>
            </div>
          </>
        )}
        {mode === 'signup' && (
          <>
            <Btn onClick={handleSignup} disabled={loading || !email || !password || !name}>
              {loading ? 'Creating account…' : 'Create account'}
            </Btn>
            <button onClick={() => { setMode('login'); reset(); }} style={{ ...linkStyle, textAlign: 'center' }}>
              Already have an account? Sign in
            </button>
          </>
        )}
        {mode === 'forgot' && (
          <>
            <Btn onClick={handleForgot} disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Btn>
            <button onClick={() => { setMode('login'); reset(); }} style={{ ...linkStyle, textAlign: 'center' }}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

// ── Onboarding: new user, no baker_contacts row yet ───────────────────────────
function Onboarding({ supabase, session, onComplete }) {
  const [bakeryName, setBakeryName] = useState('');
  const [fullName, setFullName]     = useState(session.user.user_metadata?.full_name ?? '');
  const [phone, setPhone]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function handleSetup() {
    setLoading(true); setError('');

    // 1. Create the baker (bakery entity)
    const { data: baker, error: bakerErr } = await supabase
      .from('bakers')
      .insert({ name: bakeryName.trim() })
      .select('id')
      .single();

    if (bakerErr) { setError(bakerErr.message); setLoading(false); return; }

    // 2. Create the baker_contacts row linked to auth user
    const { error: contactErr } = await supabase
      .from('baker_contacts')
      .insert({
        auth_user_id: session.user.id,
        baker_id:     baker.id,
        name:         fullName.trim(),
        email:        session.user.email,
        phone:        phone.trim() || null,
        role:         'owner',
        is_primary:   true,
      });

    if (contactErr) { setError(contactErr.message); setLoading(false); return; }

    onComplete();
  }

  return (
    <Card title="Set up your bakery" subtitle="Just a few details to get started" emoji="🏪">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Bakery name"  value={bakeryName} onChange={setBakeryName} disabled={loading} placeholder="e.g. Sweet Layers Bakery" />
        <Input label="Your name"    value={fullName}   onChange={setFullName}   disabled={loading} />
        <Input label="Phone (optional)" value={phone}  onChange={setPhone}      disabled={loading} placeholder="+1 555 000 0000" />
      </div>

      {error && <Alert message={error} type="error" />}

      <Btn onClick={handleSetup} disabled={loading || !bakeryName.trim() || !fullName.trim()}>
        {loading ? 'Setting up…' : 'Create my bakery'}
      </Btn>

      <button
        onClick={() => supabase.auth.signOut()}
        style={{ ...linkStyle, textAlign: 'center', fontSize: 12 }}
      >
        Sign out
      </button>
    </Card>
  );
}

// ── AuthGate ──────────────────────────────────────────────────────────────────
export default function AuthGate({ supabase, children }) {
  const [session, setSession]   = useState(undefined); // undefined = loading
  const [contact, setContact]   = useState(undefined); // undefined = loading, null = not found
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) setContact(undefined); // reset on logout
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // When session arrives, check for baker_contacts row
  useEffect(() => {
    if (!session) return;
    setChecking(true);
    supabase
      .from('baker_contacts')
      .select('id, auth_user_id, baker_id, name, role, is_primary')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setContact(data ?? null);
        setChecking(false);
      });
  }, [session, supabase]);

  const isLoading = session === undefined || (session && (checking || contact === undefined));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: BRAND_LIGHT }}>
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ fontFamily: FONT, color: BRAND, fontSize: 15 }}>Loading…</div>
      </div>
    );
  }

  if (!session) return <AuthForms supabase={supabase} />;

  if (!contact) {
    return (
      <Onboarding
        supabase={supabase}
        session={session}
        onComplete={() => {
          // Re-fetch contact after onboarding completes
          supabase
            .from('baker_contacts')
            .select('id, baker_id, full_name, role, is_primary')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data }) => setContact(data ?? null));
        }}
      />
    );
  }

  return children;
}
