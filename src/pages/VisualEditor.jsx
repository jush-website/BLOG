import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage, provider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { FaUserCircle, FaSignOutAlt, FaShareAlt, FaPlus, FaTrash, FaImage, FaGripVertical, FaAlignLeft, FaLink, FaChevronRight, FaArrowsAlt, FaShareSquare } from 'react-icons/fa';
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// 預設假資料
const defaultData = {
  profile: {
    name: "請輸入暱稱",
    avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop",
    phone: "",
    email: "",
    bio: "",
    bgImageUrl: "",
    bgOpacity: 0.1
  },
  sections: [
    {
      id: "sec-1",
      title: "我的作品集",
      items: [
        { id: "i1", type: "image", size: "medium", title: "畫作展示", date: "2024年1月1日", imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=500&auto=format&fit=crop" },
        { id: "i2", type: "text", size: "small", title: "關於創作", date: "2024年2月10日", textContent: "這是一篇簡短的文章，用來記錄我對藝術與設計理念的看法與心得。" },
        { id: "i3", type: "link", size: "small", title: "我的社群連結", date: "2024年3月5日", imageUrl: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=500&auto=format&fit=crop", url: "https://google.com" }
      ]
    }
  ],
  slug: ""
};

const getAutoLayout = (items) => {
  let currentX = 0;
  let currentY = 0;
  return items.map((item) => {
    if (item.gridLayout) return item.gridLayout;
    
    const w = item.size === 'large' ? 3 : item.size === 'medium' ? 2 : 1;
    if (currentX + w > 3) {
      currentX = 0;
      currentY += 2;
    }
    const layout = { i: item.id, x: currentX, y: currentY, w, h: 2 };
    currentX += w;
    return layout;
  });
};

export default function VisualEditor({ user }) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [toast, setToast] = useState('');
  const [isDragMode, setIsDragMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);
  const [selectedSectionToAdd, setSelectedSectionToAdd] = useState('');

  const mainRef = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateData = (updater) => {
    setData(updater);
    setHasUnsavedChanges(true);
  };
  const [mainWidth, setMainWidth] = useState(1200);

  useEffect(() => {
    if (!loading && mainRef.current) {
      // 確保初始寬度扣除左右各 50px 的 padding
      setMainWidth(mainRef.current.clientWidth - 100);
      const observer = new ResizeObserver(entries => {
        if (entries[0]) setMainWidth(entries[0].contentRect.width);
      });
      observer.observe(mainRef.current);
      return () => observer.disconnect();
    }
  }, [loading]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSectionId(entry.target.id);
        }
      });
    }, { rootMargin: '-20% 0px -50% 0px' });
    
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => observer.observe(sec));
    return () => observer.disconnect();
  }, [loading, data.sections]);

  // Handle scroll to bottom to force selecting the last section
  useEffect(() => {
    if (loading) return;
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
        if (data.sections.length > 0) {
          setActiveSectionId(data.sections[data.sections.length - 1].id);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, data.sections]);

  // Sync the toolbox dropdown with the active section on scroll
  useEffect(() => {
    if (activeSectionId) {
      setSelectedSectionToAdd(activeSectionId);
    }
  }, [activeSectionId]);

  useEffect(() => {
    if (!user) {
      setData(defaultData);
      setLoading(false);
      return;
    }
    const loadUserData = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          let dbData = docSnap.data();
          // 強制更新 slug 為固定 UID
          if (dbData.slug !== user.uid) {
            dbData.slug = user.uid;
            await setDoc(docRef, { slug: user.uid }, { merge: true });
          }
          setData(dbData);
        } else {
          // 全新帳號初始化，使用 uid 作為固定 slug
          const newData = { ...defaultData, slug: user.uid };
          await setDoc(docRef, newData);
          setData(newData);
        }
      } catch (error) {
        console.error("載入失敗", error);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, [user]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("登入失敗: " + error.message); }
  };
  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("您有未儲存的變更！確定要直接登出嗎？未儲存的內容將會遺失。")) return;
    }
    await signOut(auth);
  };

  const handleProfileChange = (field, value) => {
    updateData(prev => ({ ...prev, profile: { ...prev.profile, [field]: value } }));
  };

  const handleSectionTitleChange = (sectionId, value) => {
    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, title: value } : s)
    }));
  };

  const handleLayoutChange = (sectionId, layout) => {
    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map(item => {
            const itemLayout = layout.find(l => l.i === item.id);
            if (itemLayout) {
              const newSize = itemLayout.w >= 3 ? 'large' : itemLayout.w === 2 ? 'medium' : 'small';
              const cleanLayout = {};
              Object.keys(itemLayout).forEach(key => {
                if (itemLayout[key] !== undefined) {
                  cleanLayout[key] = itemLayout[key];
                }
              });
              return { ...item, gridLayout: cleanLayout, size: newSize };
            }
            return item;
          })
        };
      })
    }));
  };

  const handleItemChange = (sectionId, itemId, field, value) => {
    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map(item => item.id === itemId ? { ...item, [field]: value } : item)
        };
      })
    }));
  };

  const uploadImage = async (file, pathRef) => {
    if (!file) return null;
    const storageRef = ref(storage, `uploads/${user.uid}/${pathRef}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleProfileImageUpload = (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 400; // Small limit for avatar to save space
        
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.8);
        handleProfileChange('avatarUrl', base64String);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleBgImageUpload = (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600; // Limit max resolution to keep Base64 size small for Firestore
        
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG to save space
        const base64String = canvas.toDataURL('image/jpeg', 0.6);
        handleProfileChange('bgImageUrl', base64String);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleItemImageUpload = (sectionId, itemId, e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200; // Smaller limit for card images
        
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        handleItemChange(sectionId, itemId, 'imageUrl', base64String);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const addSection = () => {
    updateData(prev => ({
      ...prev,
      sections: [...prev.sections, { id: nanoid(4), title: "新分類", items: [] }]
    }));
  };

  const moveSection = (index, direction) => {
    updateData(prev => {
      const newSections = [...prev.sections];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newSections.length) return prev;
      
      const temp = newSections[index];
      newSections[index] = newSections[targetIndex];
      newSections[targetIndex] = temp;
      
      return { ...prev, sections: newSections };
    });
  };

  const addItem = (sectionId, type) => {
    let newItem;
    const today = new Date().toLocaleDateString('zh-TW');
    if (type === 'text') {
      newItem = { id: nanoid(4), type: 'text', size: 'medium', title: "新文章標題", date: today, textContent: "在此輸入您的文章內容..." };
    } else if (type === 'link') {
      newItem = { id: nanoid(4), type: 'link', size: 'small', title: "新連結標題", date: today, imageUrl: "", url: "https://" };
    } else {
      newItem = { id: nanoid(4), type: 'image', size: 'small', title: "新畫作標題", date: today, imageUrl: "" };
    }
      
    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return { ...s, items: [...s.items, newItem] };
      })
    }));
  };

  const handleAddItemGlobal = (type) => {
    const targetSectionId = selectedSectionToAdd || activeSectionId || (data.sections.length > 0 ? data.sections[0].id : null);
    if (!targetSectionId) {
      showToast('請先新增分類！');
      return;
    }
    addItem(targetSectionId, type);
    showToast(`已新增內容至所選分類！`);
  };

  const removeItem = (sectionId, itemId) => {
    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s)
    }));
  };

  const moveItem = (sourceSectionId, targetSectionId, itemId) => {
    if (sourceSectionId === targetSectionId) return;
    updateData(prev => {
      let itemToMove = null;
      // Remove from source
      const newSections = prev.sections.map(s => {
        if (s.id === sourceSectionId) {
          itemToMove = s.items.find(i => i.id === itemId);
          return { ...s, items: s.items.filter(i => i.id !== itemId) };
        }
        return s;
      });

      if (!itemToMove) return prev;

      // Clean up layout to reset position
      itemToMove = { ...itemToMove };
      delete itemToMove.gridLayout;

      // Add to target
      return {
        ...prev,
        sections: newSections.map(s => {
          if (s.id === targetSectionId) {
            return { ...s, items: [...s.items, itemToMove] };
          }
          return s;
        })
      };
    });
    showToast('已成功移動項目！');
  };

  const saveChanges = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), data);
      setHasUnsavedChanges(false);
      showToast("儲存成功！");
    } catch (error) {
      showToast("儲存失敗: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/p/${user.uid}`;
    navigator.clipboard.writeText(url);
    showToast(`已複製專屬連結！`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">載入中...</div>
      </div>
    );
  }

  const isEditing = !!user;

  return (
    <div className="app-wrapper">
      {data.profile.bgImageUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
          backgroundImage: `url(${data.profile.bgImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
          opacity: data.profile.bgOpacity ?? 0.1
        }} />
      )}
      
      {toast && <div className="toast-overlay">{toast}</div>}
      
      {saving && (
        <div className="loading-container" style={{ position: 'fixed', zIndex: 9999, background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(4px)' }}>
          <div className="spinner"></div>
          <div className="loading-text" style={{ marginTop: '15px', color: '#333', fontWeight: 'bold', letterSpacing: '1px' }}>資料儲存中，請稍候...</div>
        </div>
      )}
      
      <div className="top-right-auth" style={{ display: 'flex', gap: '15px' }}>
        {isEditing ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div title={isDragMode ? "關閉排版模式" : "開啟排版模式"} className="login-icon" onClick={() => setIsDragMode(!isDragMode)} style={{ background: isDragMode ? '#4CAF50' : '#fff', color: isDragMode ? '#fff' : '#222' }}><FaArrowsAlt /></div>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>排版</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div title="複製公開分享連結" className="login-icon" onClick={copyShareLink} style={{ color: '#222' }}><FaShareAlt /></div>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>分享</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div title="儲存變更" className="login-icon" onClick={saving ? null : saveChanges} style={{ background: saving ? '#f5f5f5' : '#fff', color: saving ? '#ccc' : '#4CAF50', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease' }}>
                {saving ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: '#aaa' }}></div> : <span>💾</span>}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>{saving ? '儲存中...' : '儲存'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div title="登出" className="login-icon" onClick={handleLogout} style={{ color: '#222' }}><FaSignOutAlt /></div>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>登出</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div title="管理員登入" className="login-icon" onClick={handleLogin}><FaUserCircle size={24} /></div>
            <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>登入</span>
          </div>
        )}
      </div>

      {/* Global Add Item Toolbar (Collapsible & Mobile Responsive) */}
      {isEditing && data.sections.length > 0 && (
        <div 
          className="toolbox-wrapper"
          style={{
            '--toggle-right': isToolboxOpen ? '75px' : '0',
            '--toggle-bottom': isToolboxOpen ? '75px' : '0',
            '--panel-opacity': isToolboxOpen ? 1 : 0,
            '--panel-transform': isToolboxOpen ? 'translateX(0)' : 'translateX(50px)',
            '--panel-transform-mobile': isToolboxOpen ? 'translateY(0)' : 'translateY(50px)',
            '--panel-events': isToolboxOpen ? 'auto' : 'none'
          }}
        >
          {/* Toggle Button */}
          <div 
             title={isToolboxOpen ? "收合新增選單" : "展開新增選單"}
             className="icon-btn toolbox-toggle-btn" 
             style={{ 
               background: isToolboxOpen ? '#fff' : '#8a63d2', 
               color: isToolboxOpen ? '#8a63d2' : '#fff', 
               border: isToolboxOpen ? '1px solid #ddd' : 'none'
             }}
             onClick={() => setIsToolboxOpen(!isToolboxOpen)}
          >
            {isToolboxOpen ? <FaChevronRight size={16} /> : <FaPlus size={16} />}
          </div>

          {/* Toolbox Panel */}
          <div className="toolbox-panel" style={{ alignItems: 'center' }}>
            <div className="toolbox-label" style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'bold', marginBottom: '8px' }}>新增項目至</div>
            
            <select 
              value={selectedSectionToAdd || (data.sections.length > 0 ? data.sections[0].id : '')}
              onChange={(e) => setSelectedSectionToAdd(e.target.value)}
              className="toolbox-select"
            >
              {data.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            <div className="toolbox-actions">
              <div className="icon-btn" onClick={() => handleAddItemGlobal('image')} title="新增畫作">
                <FaImage size={18} style={{ marginBottom: '2px' }} />
              </div>
              <div className="icon-btn" onClick={() => handleAddItemGlobal('text')} title="新增文章">
                <FaAlignLeft size={18} style={{ marginBottom: '2px' }} />
              </div>
              <div className="icon-btn" onClick={() => handleAddItemGlobal('link')} title="新增連結">
                <FaLink size={18} style={{ marginBottom: '2px' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={data.profile.avatarUrl} alt="Logo" className="sidebar-logo" />
          {isEditing && (
            <label className="icon-btn" style={{ position: 'absolute', bottom: '20px', right: '-10px' }}>
              <FaImage size={14} />
              <input type="file" style={{ display: 'none' }} onChange={handleProfileImageUpload} />
            </label>
          )}
        </div>
        
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input className="inline-input sidebar-name" style={{ marginBottom: '15px' }} value={data.profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
            <textarea 
              className="inline-input" 
              style={{ fontSize: '0.85rem', color: '#666', marginBottom: '30px', resize: 'vertical', minHeight: '60px', padding: '8px', lineHeight: '1.4' }} 
              placeholder="寫一段簡短的自我介紹..." 
              value={data.profile.bio || ''} 
              onChange={e => handleProfileChange('bio', e.target.value)} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="sidebar-name" style={{ marginBottom: data.profile.bio ? '15px' : '40px' }}>{data.profile.name}</h1>
            {data.profile.bio && (
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '30px', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {data.profile.bio}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#999', letterSpacing: '2px' }}>分類選單</span>
          {isEditing && (
            <div className="icon-btn" onClick={addSection} title="新增分類" style={{ width: '28px', height: '28px', margin: 0, background: '#8a63d2', color: '#fff', border: 'none' }}>
              <FaPlus size={12} />
            </div>
          )}
        </div>

        <ul className="nav-menu">
          {data.sections.map(sec => (
            <li key={sec.id} className="nav-item">
              <a href={`#${sec.id}`} onClick={() => setActiveSectionId(sec.id)}>{sec.title}</a>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', color: '#666' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input className="inline-input" style={{ fontSize: '0.85rem', margin: 0, padding: '4px' }} placeholder="聯絡電話" value={data.profile.phone || ''} onChange={e => handleProfileChange('phone', e.target.value)} />
                <input className="inline-input" style={{ fontSize: '0.85rem', margin: 0, padding: '4px' }} placeholder="電子郵件" value={data.profile.email || ''} onChange={e => handleProfileChange('email', e.target.value)} />
              </div>
              <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>網站背景</div>
                <label className="icon-btn" style={{ width: '100%', height: '36px', borderRadius: '4px', fontSize: '0.8rem', margin: 0, border: '1px dashed #ccc' }}>
                  <FaImage style={{ marginRight: '5px' }} /> {data.profile.bgImageUrl ? "更換背景圖片" : "上傳背景圖片"}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                </label>
                {data.profile.bgImageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>透明度</span>
                    <input type="range" min="0.05" max="1" step="0.05" value={data.profile.bgOpacity ?? 0.1} onChange={e => handleProfileChange('bgOpacity', parseFloat(e.target.value))} style={{ flex: 1 }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              {data.profile.phone && <div>📞 {data.profile.phone}</div>}
              {data.profile.email && <div>✉️ <a href={`mailto:${data.profile.email}`} style={{ textDecoration: 'underline' }}>{data.profile.email}</a></div>}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        {data.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="section">
            
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '10px' }}>
                <input 
                  className="inline-input section-title" 
                  style={{ margin: 0, width: 'auto' }}
                  value={section.title} 
                  onChange={e => handleSectionTitleChange(section.id, e.target.value)} 
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    className="icon-btn" 
                    style={{ width: '28px', height: '28px', opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'default' : 'pointer' }} 
                    onClick={() => moveSection(index, -1)} 
                    disabled={index === 0} 
                    title="將分類往上移"
                  >↑</button>
                  <button 
                    className="icon-btn" 
                    style={{ width: '28px', height: '28px', opacity: index === data.sections.length - 1 ? 0.3 : 1, cursor: index === data.sections.length - 1 ? 'default' : 'pointer' }} 
                    onClick={() => moveSection(index, 1)} 
                    disabled={index === data.sections.length - 1} 
                    title="將分類往下移"
                  >↓</button>
                </div>
              </div>
            ) : (
              <h2 className="section-title">{section.title}</h2>
            )}

            <Responsive
              className="layout"
              width={mainWidth || 1200}
              layouts={{ lg: getAutoLayout(section.items).map(l => ({ ...l, static: !(isEditing && isDragMode), isDraggable: !!(isEditing && isDragMode), isResizable: !!(isEditing && isDragMode) })) }}
              breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
              cols={{lg: 3, md: 3, sm: 2, xs: 1, xxs: 1}}
              rowHeight={150}
              margin={[30, 40]}
              onLayoutChange={(currentLayout) => handleLayoutChange(section.id, currentLayout)}
              isDraggable={!!(isEditing && isDragMode)}
              isResizable={!!(isEditing && isDragMode)}
              useCSSTransforms={true}
              draggableHandle=".drag-handle"
            >
              {section.items.map(item => {
                const itemSize = item.size || 'small';
                const itemType = item.type || 'image';

                return (
                  <div key={item.id} className={`card`} style={{ height: '100%' }}>
                    {/* Drag Handle & Size Selector (Editor Only) */}
                    {isEditing && isDragMode && (
                      <div className="size-selector drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                        <div style={{ padding: '0 8px', color: '#ccc' }}><FaGripVertical /></div>
                        <button className={`size-btn ${itemSize === 'small' ? 'active' : ''}`} onMouseDown={e => e.stopPropagation()} onClick={() => {
                          handleItemChange(section.id, item.id, 'size', 'small');
                          if(item.gridLayout) handleItemChange(section.id, item.id, 'gridLayout', {...item.gridLayout, w: 1});
                        }}>S</button>
                        <button className={`size-btn ${itemSize === 'medium' ? 'active' : ''}`} onMouseDown={e => e.stopPropagation()} onClick={() => {
                          handleItemChange(section.id, item.id, 'size', 'medium');
                          if(item.gridLayout) handleItemChange(section.id, item.id, 'gridLayout', {...item.gridLayout, w: 2, x: item.gridLayout.x + 2 > 3 ? 1 : item.gridLayout.x});
                        }}>M</button>
                        <button className={`size-btn ${itemSize === 'large' ? 'active' : ''}`} onMouseDown={e => e.stopPropagation()} onClick={() => {
                          handleItemChange(section.id, item.id, 'size', 'large');
                          if(item.gridLayout) handleItemChange(section.id, item.id, 'gridLayout', {...item.gridLayout, w: 3, x: 0});
                        }}>L</button>
                      </div>
                    )}

                    {/* Image or Link Block (Both have images) */}
                    {(itemType === 'image' || itemType === 'link') && (
                      <div className="card-image-wrapper">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="card-image" /> : <div className="card-image" style={{ background: '#eee' }} />}
                        {isEditing && (
                          <div className="edit-overlay">
                            <label className="icon-btn" title="更換圖片"><FaImage size={14} /><input type="file" style={{ display: 'none' }} onChange={(e) => handleItemImageUpload(section.id, item.id, e)} /></label>
                            {data.sections.length > 1 && (
                              <div className="icon-btn" style={{ position: 'relative' }} title="移動至其他分類">
                                <FaShareSquare size={14} />
                                <select
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      moveItem(section.id, e.target.value, item.id);
                                      e.target.value = '';
                                    }
                                  }}
                                  value=""
                                >
                                  <option value="" disabled>移動至...</option>
                                  {data.sections.filter(s => s.id !== section.id).map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="icon-btn" title="刪除項目" onClick={() => removeItem(section.id, item.id)}><FaTrash size={14} /></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Block */}
                    {itemType === 'text' && (
                      <div className="card-text-only" style={{ position: 'relative' }}>
                        {isEditing ? (
                          <textarea 
                            className="inline-textarea" 
                            value={item.textContent || ''} 
                            onChange={e => handleItemChange(section.id, item.id, 'textContent', e.target.value)}
                            placeholder="輸入文章內容..."
                          />
                        ) : (
                          <div className="card-text-content">{item.textContent}</div>
                        )}
                        {isEditing && (
                           <div className="edit-overlay" style={{ opacity: 0, transition: '0.2s', background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
                              <div style={{ pointerEvents: 'auto', position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                                {data.sections.length > 1 && (
                                  <div className="icon-btn" style={{ position: 'relative' }} title="移動至其他分類">
                                    <FaShareSquare size={14} />
                                    <select
                                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          moveItem(section.id, e.target.value, item.id);
                                          e.target.value = '';
                                        }
                                      }}
                                      value=""
                                    >
                                      <option value="" disabled>移動至...</option>
                                      {data.sections.filter(s => s.id !== section.id).map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <div className="icon-btn" title="刪除項目" onClick={() => removeItem(section.id, item.id)}><FaTrash size={14} /></div>
                              </div>
                           </div>
                        )}
                      </div>
                    )}
                    
                    {/* Title & Date & Link URL (Except for Text-Only cards which don't need these here, wait text cards DO need title and date! Let's wrap them) */}
                    <div className="card-content-area" style={{ display: itemType === 'text' ? 'none' : 'flex' }}>
                      {isEditing ? (
                        <>
                          {itemType === 'link' && (
                             <input className="inline-input" style={{ color: '#8a63d2', fontWeight: 'bold' }} value={item.url || ''} onChange={e => handleItemChange(section.id, item.id, 'url', e.target.value)} placeholder="輸入連結網址 (https://...)" />
                          )}
                          <input className="inline-input card-title" style={{ fontWeight: 'bold', fontSize: '1.1rem' }} value={item.title} onChange={e => handleItemChange(section.id, item.id, 'title', e.target.value)} placeholder="輸入標題或介紹..." />
                          <input className="inline-input card-date" style={{ fontSize: '0.8rem', color: '#888' }} value={item.date} onChange={e => handleItemChange(section.id, item.id, 'date', e.target.value)} />
                        </>
                      ) : (
                        <>
                          <h3 className="card-title">{item.title}</h3>
                          <span className="card-date">{item.date}</span>
                        </>
                      )}
                    </div>

                    {/* Show title and date for text block at the bottom */}
                    {itemType === 'text' && (
                       <div style={{ padding: '0 25px 25px 25px', display: 'flex', flexDirection: 'column' }}>
                         {isEditing ? (
                          <>
                            <input className="inline-input card-title" style={{ fontWeight: 'bold', fontSize: '1.1rem' }} value={item.title} onChange={e => handleItemChange(section.id, item.id, 'title', e.target.value)} placeholder="輸入文章標題..." />
                            <input className="inline-input card-date" style={{ fontSize: '0.8rem', color: '#888' }} value={item.date} onChange={e => handleItemChange(section.id, item.id, 'date', e.target.value)} />
                          </>
                         ) : (
                          <>
                            <h3 className="card-title">{item.title}</h3>
                            <span className="card-date">{item.date}</span>
                          </>
                         )}
                       </div>
                    )}
                  </div>
                );
              })}
            </Responsive>
            {section.items.length === 0 && (
              <div style={{ color: '#aaa', fontStyle: 'italic', marginTop: '20px' }}>此分類尚無作品，請從右側選單新增。</div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
