import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VisualEditor from './pages/VisualEditor';
import PublicShareView from './pages/PublicShareView';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">載入中...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 編輯器與預設首頁 (共用同一個元件，內部判斷是否登入) */}
        <Route path="/" element={<VisualEditor user={user} />} />
        
        {/* 亂碼分享網址 (純觀看) */}
        <Route path="/p/:slug" element={<PublicShareView />} />
        
        {/* 舊的路由保護 (可選保留或移除，這裡導回首頁) */}
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/admin" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
