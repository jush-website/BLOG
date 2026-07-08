import React, { useState, useEffect, useRef, useMemo } from 'react';
import { auth, db, provider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { FaUserCircle, FaSignOutAlt, FaShareAlt, FaPlus, FaTrash, FaImage, FaGripVertical, FaAlignLeft, FaLink, FaChevronRight, FaArrowsAlt, FaShareSquare, FaSave, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';
import { Responsive } from 'react-grid-layout';
import { getAutoLayout, useContainerWidth, BREAKPOINTS, GRID_COLS, THREE_COL_MIN_WIDTH } from '../grid';
import { toDirectImageUrl } from '../urls';
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

// ponytail: images live inline as base64 in the Firestore doc, which is capped at
// 1 MiB. Firebase Storage would fix this but needs the Blaze plan (a credit card),
// so instead we squeeze the bytes and surface the budget (see docBytes below).
const FIRESTORE_DOC_LIMIT = 1048576; // 1 MiB, Firestore's hard per-document cap

// Safari only learned to *encode* WebP recently; toDataURL silently falls back to
// PNG when the type is unsupported, which would be far bigger than the JPEG.
let webpSupported;
const bestImageType = () => {
  if (webpSupported === undefined) {
    webpSupported = document
      .createElement('canvas')
      .toDataURL('image/webp')
      .startsWith('data:image/webp');
  }
  return webpSupported ? 'image/webp' : 'image/jpeg';
};

const resizeToDataUrl = (file, maxDim, quality) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL(bestImageType(), quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('圖片讀取失敗'));
    };
    img.src = objectUrl;
  });

// The five top-right controls were five copies of the same 4-line block.
function AuthAction({ label, title, onClick, active, disabled, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
      <div
        className="login-icon"
        title={title}
        onClick={onClick}
        style={{
          background: active ? 'var(--accent)' : undefined,
          borderColor: active ? 'var(--accent)' : undefined,
          color: active ? 'var(--accent-ink)' : undefined,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {children}
      </div>
      <span className="auth-label">{label}</span>
    </div>
  );
}

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
  const mainWidth = useContainerWidth(mainRef, !loading);

  // Close enough to what Firestore counts, and it's the number the user can act on.
  const docBytes = useMemo(() => new Blob([JSON.stringify(data)]).size, [data]);
  const docUsage = docBytes / FIRESTORE_DOC_LIMIT;
  const budgetLevel = docUsage > 0.9 ? 'over' : docUsage > 0.7 ? 'warn' : '';

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
    // Only persist a deliberate rearrangement. react-grid-layout also fires this on
    // mount and on every breakpoint reflow — saving those marks the doc dirty on page
    // load and overwrites the 3-col layout with the narrow-screen 1-col one.
    // 996 = the `md` breakpoint; md and lg both have 3 cols, so either is safe to save.
    if (!isDragMode || mainWidth < THREE_COL_MIN_WIDTH) return;

    updateData(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map(item => {
            const l = layout.find(entry => entry.i === item.id);
            if (!l) return item;
            return {
              ...item,
              gridLayout: { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h },
              size: l.w >= 3 ? 'large' : l.w === 2 ? 'medium' : 'small'
            };
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

  // maxDim/quality are per-slot: avatars are tiny, backgrounds are the biggest thing on screen.
  const pickImage = (e, maxDim, quality, apply) => {
    const file = e.target.files[0];
    e.target.value = ''; // otherwise re-selecting the same file fires no change event
    if (!file || !user) return;
    resizeToDataUrl(file, maxDim, quality).then(apply).catch(err => showToast(err.message));
  };

  // A pasted URL costs ~60 bytes in Firestore instead of ~85KB of base64.
  // ponytail: window.prompt keeps this out of the card layout entirely.
  const pasteImageUrl = (current, apply) => {
    const url = window.prompt('貼上圖片網址（支援 Google Drive 分享連結）：', current?.startsWith('data:') ? '' : current || '');
    if (url === null) return; // cancelled
    apply(url.trim());
  };

  const addSection = () => {
    updateData(prev => ({
      ...prev,
      sections: [...prev.sections, { id: nanoid(4), title: "新分類", items: [] }]
    }));
  };

  const removeSection = (section) => {
    const warning = section.items.length
      ? `確定要刪除分類「${section.title}」嗎？其中的 ${section.items.length} 個項目也會一併刪除。`
      : `確定要刪除分類「${section.title}」嗎？`;
    if (!window.confirm(warning)) return;
    updateData(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== section.id) }));
    showToast('已刪除分類，記得儲存變更。');
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

  // The dropdown can still hold a section the user just deleted — fall through to a live one.
  const addTargetId = [selectedSectionToAdd, activeSectionId, data.sections[0]?.id]
    .find(id => id && data.sections.some(s => s.id === id)) ?? '';

  const handleAddItemGlobal = (type) => {
    if (!addTargetId) {
      showToast('請先新增分類！');
      return;
    }
    addItem(addTargetId, type);
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

    // Fail before the network round-trip, and say what to actually do about it —
    // Firestore's own error here is an opaque INVALID_ARGUMENT.
    if (docBytes > FIRESTORE_DOC_LIMIT) {
      showToast(`資料量 ${(docBytes / 1048576).toFixed(2)} MB 已超過單筆 1 MB 上限，無法儲存。請刪除或更換幾張圖片後再試。`);
      return;
    }

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
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
          backgroundImage: `url(${data.profile.bgImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: data.profile.bgOpacity ?? 0.1
        }} />
      )}
      
      {toast && <div className="toast-overlay">{toast}</div>}
      
      {saving && (
        <div className="loading-container" style={{ position: 'fixed', zIndex: 9999, background: 'var(--scrim)', backdropFilter: 'blur(4px)' }}>
          <div className="spinner"></div>
          <div className="loading-text" style={{ marginTop: '15px' }}>資料儲存中，請稍候...</div>
        </div>
      )}

      <div className="top-right-auth" style={{ display: 'flex', gap: '14px' }}>
        {isEditing ? (
          <>
            <AuthAction label="排版" title={isDragMode ? "關閉排版模式" : "開啟排版模式"} onClick={() => setIsDragMode(!isDragMode)} active={isDragMode}><FaArrowsAlt /></AuthAction>
            <AuthAction label="分享" title="複製公開分享連結" onClick={copyShareLink}><FaShareAlt /></AuthAction>
            <AuthAction label={saving ? '儲存中' : '儲存'} title="儲存變更" onClick={saving ? undefined : saveChanges} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: '16px', height: '16px', marginBottom: 0 }} /> : <FaSave />}
            </AuthAction>
            <AuthAction label="登出" title="登出" onClick={handleLogout}><FaSignOutAlt /></AuthAction>
          </>
        ) : (
          <AuthAction label="登入" title="管理員登入" onClick={handleLogin}><FaUserCircle size={22} /></AuthAction>
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
               background: isToolboxOpen ? 'var(--surface)' : 'var(--accent)',
               color: isToolboxOpen ? 'var(--accent)' : 'var(--accent-ink)',
               border: `1px solid ${isToolboxOpen ? 'var(--rule)' : 'var(--accent)'}`
             }}
             onClick={() => setIsToolboxOpen(!isToolboxOpen)}
          >
            {isToolboxOpen ? <FaChevronRight size={16} /> : <FaPlus size={16} />}
          </div>

          {/* Toolbox Panel */}
          <div className="toolbox-panel" style={{ alignItems: 'center' }}>
            <div className="toolbox-label">新增項目至</div>
            
            <select
              value={addTargetId}
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
            <label className="icon-btn" style={{ position: 'absolute', bottom: '20px', right: '-10px' }} title="更換頭像">
              <FaImage size={14} />
              {/* avatar renders ~100px; 256 covers retina */}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickImage(e, 256, 0.8, url => handleProfileChange('avatarUrl', url))} />
            </label>
          )}
        </div>
        
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input className="inline-input sidebar-name" style={{ marginBottom: '15px' }} value={data.profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
            <textarea 
              className="inline-input" 
              style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '32px', resize: 'vertical', minHeight: '72px', padding: '10px', lineHeight: '1.7' }}
              placeholder="寫一段簡短的自我介紹..."
              value={data.profile.bio || ''} 
              onChange={e => handleProfileChange('bio', e.target.value)} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="sidebar-name" style={{ marginBottom: data.profile.bio ? '16px' : '40px' }}>{data.profile.name}</h1>
            {data.profile.bio && (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '32px', lineHeight: '1.7', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {data.profile.bio}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span className="toolbox-label" style={{ marginBottom: 0 }}>分類選單</span>
          {isEditing && (
            <div className="icon-btn" onClick={addSection} title="新增分類" style={{ width: '26px', height: '26px', margin: 0, background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }}>
              <FaPlus size={11} />
            </div>
          )}
        </div>

        <ul className="nav-menu">
          {data.sections.map(sec => (
            <li key={sec.id} className={`nav-item${activeSectionId === sec.id ? ' active' : ''}`}>
              <a href={`#${sec.id}`} onClick={() => setActiveSectionId(sec.id)}>{sec.title}</a>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--rule)', fontSize: '0.9rem', color: 'var(--ink-muted)', width: '100%', boxSizing: 'border-box' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input className="inline-input" style={{ fontSize: '0.85rem', margin: 0, padding: '6px 8px' }} placeholder="聯絡電話" value={data.profile.phone || ''} onChange={e => handleProfileChange('phone', e.target.value)} />
                <input className="inline-input" style={{ fontSize: '0.85rem', margin: 0, padding: '6px 8px' }} placeholder="電子郵件" value={data.profile.email || ''} onChange={e => handleProfileChange('email', e.target.value)} />
              </div>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div className="budget-row">
                  <span>資料用量</span>
                  <span className={`budget-value ${budgetLevel}`}>
                    {(docBytes / 1048576).toFixed(2)} / 1.00 MB
                  </span>
                </div>
                <div className="budget-track">
                  <div className={`budget-fill ${budgetLevel}`} style={{ width: `${Math.min(100, docUsage * 100)}%` }} />
                </div>
                {docUsage > 0.9 && (
                  <div className="budget-note">快到上限了，再上傳圖片將無法儲存。</div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="toolbox-label" style={{ marginBottom: 0 }}>網站背景</div>
                <label className="icon-btn" style={{ width: '100%', height: '38px', borderRadius: 'var(--radius)', fontSize: '0.8rem', margin: 0, border: '1px dashed var(--rule)' }}>
                  <FaImage style={{ marginRight: '5px' }} /> {data.profile.bgImageUrl ? "更換背景圖片" : "上傳背景圖片"}
                  {/* background sits behind opacity ~0.1, so detail is invisible anyway */}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickImage(e, 1280, 0.5, url => handleProfileChange('bgImageUrl', url))} />
                </label>
                {data.profile.bgImageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', width: '100%' }}>
                    <span style={{ whiteSpace: 'nowrap', color: 'var(--ink-muted)' }}>透明度</span>
                    <input type="range" min="0.05" max="1" step="0.05" value={data.profile.bgOpacity ?? 0.1} onChange={e => handleProfileChange('bgOpacity', parseFloat(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: 'var(--accent)' }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              {data.profile.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><FaPhoneAlt size={11} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />{data.profile.phone}</div>}
              {data.profile.email && <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><FaEnvelope size={11} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} /><a href={`mailto:${data.profile.email}`} style={{ borderBottom: '1px solid var(--rule)' }}>{data.profile.email}</a></div>}
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
                  <button
                    className="icon-btn"
                    style={{ width: '28px', height: '28px', color: 'var(--danger)' }}
                    onClick={() => removeSection(section)}
                    title="刪除分類"
                  ><FaTrash size={11} /></button>
                </div>
              </div>
            ) : (
              <h2 className="section-title">{section.title}</h2>
            )}

            <Responsive
              className="layout"
              width={mainWidth || 1200}
              layouts={{ lg: getAutoLayout(section.items).map(l => ({ ...l, static: !(isEditing && isDragMode), isDraggable: !!(isEditing && isDragMode), isResizable: !!(isEditing && isDragMode) })) }}
              breakpoints={BREAKPOINTS}
              cols={GRID_COLS}
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
                        <div style={{ padding: '0 8px', color: 'var(--ink-faint)' }}><FaGripVertical /></div>
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
                        {item.imageUrl ? <img src={toDirectImageUrl(item.imageUrl)} alt={item.title} className="card-image" /> : <div className="card-image" style={{ background: 'var(--surface-sunk)' }} />}
                        {isEditing && (
                          <div className="edit-overlay">
                            {/* Artwork keeps 1200px. Measured on a 1200x800 photo: old JPEG@0.7 = 115KB,
                                WebP@0.75 = 85KB (-27%) at higher visual quality. Pushing q past ~0.78
                                gives the bytes straight back: WebP@0.85 was 126KB, worse than the JPEG. */}
                            <label className="icon-btn" title="上傳圖片檔"><FaImage size={14} /><input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e, 1200, 0.75, url => handleItemChange(section.id, item.id, 'imageUrl', url))} /></label>
                            <div className="icon-btn" title="改用圖片網址（不佔用量）" onClick={() => pasteImageUrl(item.imageUrl, url => handleItemChange(section.id, item.id, 'imageUrl', url))}><FaLink size={14} /></div>
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
                           <div className="edit-overlay edit-overlay-corner">
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
                    
                    {/* Title & Date & Link URL (Except for Text-Only cards which don't need these here, wait text cards DO need title and date! Let's wrap them) */}
                    <div className="card-content-area" style={{ display: itemType === 'text' ? 'none' : 'flex' }}>
                      {isEditing ? (
                        <>
                          {itemType === 'link' && (
                             <input className="inline-input" style={{ color: 'var(--accent)', fontSize: '0.8rem' }} value={item.url || ''} onChange={e => handleItemChange(section.id, item.id, 'url', e.target.value)} placeholder="輸入連結網址 (https://...)" />
                          )}
                          <input className="inline-input card-title" style={{ fontWeight: 'bold', fontSize: '1.1rem' }} value={item.title} onChange={e => handleItemChange(section.id, item.id, 'title', e.target.value)} placeholder="輸入標題或介紹..." />
                          <input className="inline-input card-date" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }} value={item.date} onChange={e => handleItemChange(section.id, item.id, 'date', e.target.value)} />
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
                       <div style={{ padding: '0 32px 32px 32px', display: 'flex', flexDirection: 'column' }}>
                         {isEditing ? (
                          <>
                            <input className="inline-input card-title" style={{ fontWeight: 'bold', fontSize: '1.1rem' }} value={item.title} onChange={e => handleItemChange(section.id, item.id, 'title', e.target.value)} placeholder="輸入文章標題..." />
                            <input className="inline-input card-date" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }} value={item.date} onChange={e => handleItemChange(section.id, item.id, 'date', e.target.value)} />
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
              <div className="section-empty">此分類尚無作品，請從右側選單新增。</div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
