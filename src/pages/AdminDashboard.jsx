import React, { useState, useEffect } from 'react';
import { auth, db, storage } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

const ADMIN_DOC_ID = "admin_profile";

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState({
    headerImageUrl: '',
    name: '',
    subtitle: '',
    igUrl: '',
    email: '',
    bioBlocks: [''],
    portfolioLinks: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', ADMIN_DOC_ID));
        if (docSnap.exists()) {
          const dbData = docSnap.data();
          setData({
            headerImageUrl: dbData.headerImageUrl || '',
            name: dbData.name || '',
            subtitle: dbData.subtitle || '',
            igUrl: dbData.igUrl || '',
            email: dbData.email || '',
            bioBlocks: dbData.bioBlocks && dbData.bioBlocks.length > 0 ? dbData.bioBlocks : [''],
            portfolioLinks: dbData.portfolioLinks || []
          });
        }
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // --- Image Upload Helper ---
  const uploadImageToStorage = async (file, pathPrefix) => {
    const storageRef = ref(storage, `uploads/${ADMIN_DOC_ID}/${pathPrefix}_${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleHeaderImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToStorage(file, 'header');
      handleChange('headerImageUrl', url);
    } catch (error) {
      alert('上傳失敗，請確認 Storage 規則是否設定正確！\n' + error.message);
    }
  };

  // --- Bio Blocks ---
  const handleBioChange = (index, value) => {
    const newBlocks = [...data.bioBlocks];
    newBlocks[index] = value;
    handleChange('bioBlocks', newBlocks);
  };
  const addBioBlock = () => handleChange('bioBlocks', [...data.bioBlocks, '']);
  const removeBioBlock = (index) => handleChange('bioBlocks', data.bioBlocks.filter((_, i) => i !== index));

  // --- Portfolio Links ---
  const handleLinkChange = (index, field, value) => {
    const newLinks = [...data.portfolioLinks];
    newLinks[index][field] = value;
    handleChange('portfolioLinks', newLinks);
  };
  const addLink = () => handleChange('portfolioLinks', [...data.portfolioLinks, { title: '', subtitle: '', imageUrl: '', url: '' }]);
  const removeLink = (index) => handleChange('portfolioLinks', data.portfolioLinks.filter((_, i) => i !== index));
  
  const handleLinkImageUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToStorage(file, `link_${index}`);
      handleLinkChange(index, 'imageUrl', url);
    } catch (error) {
      alert('上傳失敗，請確認 Storage 規則！\n' + error.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', ADMIN_DOC_ID), data, { merge: true });
      alert("儲存成功！");
    } catch (error) {
      console.error("Error saving: ", error);
      alert("儲存失敗，請確認 Firestore 規則！");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>載入中...</div>;

  return (
    <div className="admin-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>系統管理後台</h2>
        <div>
          <button className="admin-btn btn-outline" onClick={() => navigate('/')} style={{ marginRight: '10px' }}>預覽畫面</button>
          <button className="admin-btn btn-danger" onClick={() => { signOut(auth); navigate('/'); }}>登出</button>
        </div>
      </div>

      <div className="admin-card">
        <h3>1. 頂部主視覺與基本資料</h3>
        <hr style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />
        
        <label>大橫幅圖片 (Header Image)</label>
        {data.headerImageUrl && <img src={data.headerImageUrl} alt="Header" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px', display: 'block' }} />}
        <input type="file" accept="image/*" onChange={handleHeaderImageUpload} className="admin-input" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <label>主標題 (姓名)</label>
        <input type="text" className="admin-input" value={data.name} onChange={e => handleChange('name', e.target.value)} placeholder="孫泗萍 Sun Shih Ping" />

        <label>副標題 (身分/理念)</label>
        <input type="text" className="admin-input" value={data.subtitle} onChange={e => handleChange('subtitle', e.target.value)} placeholder="當代油畫創作 | 王與相系列" />

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label>Instagram 網址</label>
            <input type="text" className="admin-input" value={data.igUrl} onChange={e => handleChange('igUrl', e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div style={{ flex: 1 }}>
            <label>聯絡 Email</label>
            <input type="email" className="admin-input" value={data.email} onChange={e => handleChange('email', e.target.value)} placeholder="hello@example.com" />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>2. 介紹卡片 (純文字區塊)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>每一個文字方塊都會在畫面上產生一張獨立的白色圓角卡片。</p>
        
        {data.bioBlocks.map((text, index) => (
          <div key={index} style={{ marginBottom: '15px', position: 'relative' }}>
            <textarea 
              className="admin-input" 
              value={text} 
              onChange={e => handleBioChange(index, e.target.value)} 
              placeholder="輸入介紹段落..." 
              style={{ minHeight: '120px', resize: 'vertical' }} 
            />
            <button onClick={() => removeBioBlock(index)} className="admin-btn btn-danger" style={{ position: 'absolute', top: '10px', right: '10px', padding: '5px 10px', fontSize: '0.8rem' }}>刪除卡片</button>
          </div>
        ))}
        <button onClick={addBioBlock} className="admin-btn btn-outline" style={{ width: '100%' }}>+ 新增文字卡片</button>
      </div>

      <div className="admin-card">
        <h3>3. 作品集與連結 (圖文交錯卡片)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>系統會自動將這些連結排版成左圖右文、左文右圖交錯的樣式。</p>

        {data.portfolioLinks.map((link, index) => (
          <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h4>卡片 #{index + 1}</h4>
              <button onClick={() => removeLink(index)} className="admin-btn btn-danger" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>刪除</button>
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label>縮圖上傳</label>
                {link.imageUrl && <img src={link.imageUrl} alt="preview" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '5px' }} />}
                <input type="file" accept="image/*" onChange={(e) => handleLinkImageUpload(index, e)} className="admin-input" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ flex: 2 }}>
                <input type="text" className="admin-input" value={link.title} onChange={e => handleLinkChange(index, 'title', e.target.value)} placeholder="主標題 (例：最新展覽資訊)" style={{ marginBottom: '8px' }} />
                <input type="text" className="admin-input" value={link.subtitle} onChange={e => handleLinkChange(index, 'subtitle', e.target.value)} placeholder="副標題 (英文/小字)" style={{ marginBottom: '8px' }} />
                <input type="text" className="admin-input" value={link.url} onChange={e => handleLinkChange(index, 'url', e.target.value)} placeholder="點擊後前往的網址 (https://...)" />
              </div>
            </div>
          </div>
        ))}
        <button onClick={addLink} className="admin-btn btn-outline" style={{ width: '100%' }}>+ 新增圖文連結</button>
      </div>

      <button onClick={handleSave} disabled={saving} className="admin-btn btn-primary" style={{ width: '100%', padding: '20px', fontSize: '1.2rem' }}>
        {saving ? '發布儲存中...' : '發布所有變更 🚀'}
      </button>
    </div>
  );
}

export default AdminDashboard;
