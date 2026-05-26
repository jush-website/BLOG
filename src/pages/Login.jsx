import React from 'react';
import { auth, provider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate('/admin');
    } catch (error) {
      console.error("Login failed", error);
      alert("登入失敗：" + error.message);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center' }}>
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--glass-border)',
        padding: '40px',
        borderRadius: '16px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ marginBottom: '10px' }}>管理員登入</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>請使用您的 Google 帳號登入管理後台</p>
        
        <button 
          onClick={handleGoogleLogin}
          style={{
            background: 'white',
            color: '#333',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" width="20" />
          使用 Google 登入
        </button>
      </div>
    </div>
  );
}

export default Login;
