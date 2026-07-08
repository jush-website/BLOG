import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Responsive } from 'react-grid-layout';
import { getAutoLayout, useContainerWidth, BREAKPOINTS, GRID_COLS } from '../grid';
import { toDirectImageUrl, safeHref } from '../urls';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export default function PublicShareView() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [loading, setLoading] = useState(true);

  const mainRef = useRef(null);
  const mainWidth = useContainerWidth(mainRef, !loading);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let uid = slug;
        let userDoc = await getDoc(doc(db, 'users', uid));

        if (!userDoc.exists()) {
          // Fallback to check if it's an old short slug
          const slugDoc = await getDoc(doc(db, 'slugs', slug));
          if (slugDoc.exists()) {
            uid = slugDoc.data().uid;
            userDoc = await getDoc(doc(db, 'users', uid));
          }
        }

        if (userDoc.exists()) {
          setData(userDoc.data());
        } else {
          setError('糟糕！找不到此網頁。這可能是一個無效的網址。');
        }
      } catch (err) {
        setError('系統發生錯誤: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>{error}</h2>
        <Link to="/" style={{ color: 'var(--primary-color)', textDecoration: 'underline', marginTop: '20px', display: 'inline-block' }}>回首頁</Link>
      </div>
    );
  }

  // An older or half-written doc may be missing either field — don't white-screen on it.
  const profile = data?.profile ?? {};
  const sections = data?.sections ?? [];

  return (
    <div className="app-wrapper">
      {profile.bgImageUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
          backgroundImage: `url(${profile.bgImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
          opacity: profile.bgOpacity ?? 0.1
        }} />
      )}
      <aside className="sidebar">
        <img src={profile.avatarUrl} alt="Logo" className="sidebar-logo" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 className="sidebar-name" style={{ marginBottom: profile.bio ? '15px' : '40px' }}>{profile.name}</h1>
          {profile.bio && (
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '30px', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
              {profile.bio}
            </p>
          )}
        </div>

        <ul className="nav-menu">
          {sections.map(sec => (
            <li key={sec.id} className={`nav-item${activeSectionId === sec.id ? ' active' : ''}`}>
              <a href={`#${sec.id}`} onClick={() => setActiveSectionId(sec.id)}>{sec.title}</a>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', color: '#666' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            {profile.phone && <div>📞 {profile.phone}</div>}
            {profile.email && <div>✉️ <a href={`mailto:${profile.email}`} style={{ textDecoration: 'underline' }}>{profile.email}</a></div>}
          </div>
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        {sections.map(section => (
          <section key={section.id} id={section.id} className="section">
            <h2 className="section-title">{section.title}</h2>

            <Responsive
              className="layout"
              width={mainWidth || 1200}
              layouts={{ lg: getAutoLayout(section.items) }}
              breakpoints={BREAKPOINTS}
              cols={GRID_COLS}
              rowHeight={150}
              margin={[30, 40]}
              isDraggable={false}
              isResizable={false}
              useCSSTransforms={true}
            >
              {section.items.map(item => {
                const itemType = item.type || 'image';

                // This page is shared with strangers; never navigate to an owner-supplied
                // `javascript:` or `data:` URL. safeHref returns '' for anything but http(s)/mailto.
                const href = itemType === 'link' ? safeHref(item.url) : '';
                const CardWrapper = href ? 'a' : 'div';
                const wrapperProps = href ? { href, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } } : {};

                return (
                  <CardWrapper key={item.id} className={`card`} style={{ height: '100%' }} {...wrapperProps}>
                    
                    {/* Image or Link Block */}
                    {(itemType === 'image' || itemType === 'link') && (
                      <div className="card-image-wrapper">
                        {item.imageUrl ? (
                          <img src={toDirectImageUrl(item.imageUrl)} alt={item.title} className="card-image" />
                        ) : (
                          <div className="card-image" style={{ background: '#eee' }} />
                        )}
                      </div>
                    )}

                    {/* Text Block */}
                    {itemType === 'text' && (
                      <div className="card-text-only" style={{ position: 'relative' }}>
                        <div className="card-text-content">{item.textContent}</div>
                      </div>
                    )}

                    <div className="card-content-area" style={{ display: itemType === 'text' ? 'none' : 'flex' }}>
                      <h3 className="card-title">
                        {item.title}
                        {itemType === 'link' && <span style={{ fontSize: '0.8rem', color: '#8a63d2', marginLeft: '8px' }}>↗</span>}
                      </h3>
                      <span className="card-date">{item.date}</span>
                    </div>

                    {itemType === 'text' && (
                      <div style={{ padding: '0 25px 25px 25px', display: 'flex', flexDirection: 'column' }}>
                        <h3 className="card-title">{item.title}</h3>
                        <span className="card-date">{item.date}</span>
                      </div>
                    )}
                  </CardWrapper>
                );
              })}
            </Responsive>
            {section.items.length === 0 && (
              <div style={{ color: '#aaa', fontStyle: 'italic', marginTop: '20px' }}>尚無作品。</div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
