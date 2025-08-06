import React from 'react'

function GoogleHomepage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '15px 20px',
        gap: '15px',
        fontSize: '13px'
      }}>
        <a href="#" style={{ color: '#000', textDecoration: 'none' }}>Gmail</a>
        <a href="#" style={{ color: '#000', textDecoration: 'none' }}>Images</a>
        <div style={{
          width: '24px',
          height: '24px',
          background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23666\' d=\'M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z\'/%3E%3C/svg%3E")',
          cursor: 'pointer'
        }}></div>
        <button style={{
          background: '#4285f4',
          color: 'white',
          border: 'none',
          padding: '9px 23px',
          borderRadius: '3px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          Sign in
        </button>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
        marginTop: '-100px'
      }}>
        {/* Google Logo */}
        <div style={{
          fontSize: '90px',
          fontWeight: '400',
          color: '#4285f4',
          marginBottom: '20px',
          fontFamily: 'Product Sans, Arial, sans-serif'
        }}>
          Google
        </div>

        {/* Search Box */}
        <div style={{
          width: '584px',
          maxWidth: '90%',
          marginBottom: '30px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #dfe1e5',
            borderRadius: '24px',
            padding: '8px 16px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              marginRight: '13px',
              opacity: '0.4'
            }}>
              🔍
            </div>
            <input 
              type="text" 
              placeholder="Search Google or type a URL"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                color: '#000'
              }}
            />
            <div style={{
              width: '24px',
              height: '24px',
              marginLeft: '13px',
              cursor: 'pointer'
            }}>
              🎤
            </div>
          </div>
        </div>

        {/* Search Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px'
        }}>
          <button style={{
            background: '#f8f9fa',
            border: '1px solid #f8f9fa',
            borderRadius: '4px',
            color: '#3c4043',
            fontSize: '14px',
            margin: '11px 4px',
            padding: '0 16px',
            height: '36px',
            cursor: 'pointer'
          }}>
            Google Search
          </button>
          <button style={{
            background: '#f8f9fa',
            border: '1px solid #f8f9fa',
            borderRadius: '4px',
            color: '#3c4043',
            fontSize: '14px',
            margin: '11px 4px',
            padding: '0 16px',
            height: '36px',
            cursor: 'pointer'
          }}>
            I'm Feeling Lucky
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#f2f2f2',
        borderTop: '1px solid #dadce0',
        padding: '15px 20px',
        fontSize: '14px',
        color: '#70757a'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>About</a>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>Advertising</a>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>Business</a>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>How Search works</a>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>Privacy</a>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: '#70757a', textDecoration: 'none' }}>Settings</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoogleHomepage 