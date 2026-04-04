import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../supabase'

export default function Login() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '16px',
        padding: '40px',
        width: '360px',
      }}>
        <h2 style={{ color: '#fff', marginBottom: '8px', textAlign: 'center', fontSize: '20px', fontWeight: 700 }}>
          Freelance Monitor
        </h2>
        <p style={{ color: '#555', textAlign: 'center', marginBottom: '28px', fontSize: '13px' }}>
          Адмін-панель
        </p>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#22c55e',
                  brandAccent: '#16a34a',
                  inputBackground: '#111',
                  inputBorder: '#2a2a2a',
                  inputText: '#e5e5e5',
                  inputPlaceholder: '#555',
                },
                radii: {
                  borderRadiusButton: '10px',
                  inputBorderRadius: '10px',
                },
              },
            },
          }}
          providers={[]}
          view="sign_in"
          showLinks={false}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email',
                password_label: 'Пароль',
                button_label: 'Увійти',
                email_input_placeholder: 'your@email.com',
                password_input_placeholder: '••••••••',
              },
            },
          }}
        />
      </div>
    </div>
  )
}
