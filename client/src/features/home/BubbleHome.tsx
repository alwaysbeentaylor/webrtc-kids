import { useEffect, useState } from 'react';
import { familyService } from '../../services/FamilyService';
import { firebaseService } from '../../services/FirebaseService';
import { socketService } from '../../services/SocketService';
import { ChildCodeGenerator } from '../family/ChildCodeGenerator';

export interface Contact {
  id: string;
  name: string;
  type: 'parent' | 'child';
  avatar?: string;
  isOnline?: boolean;
  gender?: 'boy' | 'girl' | null;
}

interface BubbleHomeProps {
  onCallContact: (contactId: string, contactName: string, remoteRole?: 'parent' | 'child') => void;
  isParent: boolean;
  familyId: string;
  currentUserId: string;
  currentUserName: string;
}

export function BubbleHome({ onCallContact, isParent, familyId, currentUserId, currentUserName: initialUserName }: BubbleHomeProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ childId: string; childName: string } | null>(null);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [bubblePositions, setBubblePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedBubbleId, setDraggedBubbleId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [socketTransport, setSocketTransport] = useState<string>('unknown');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Contact | null>(null);
  const [newCodeForChild, setNewCodeForChild] = useState<{ childId: string; code: string } | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string>('Welkom, mijn familie');
  const [currentUserName, setCurrentUserName] = useState<string>(initialUserName);

  // Sync currentUserName with prop changes
  useEffect(() => {
    setCurrentUserName(initialUserName);
  }, [initialUserName]);

  useEffect(() => {
    console.log('🔄 BubbleHome useEffect triggered:', { familyId, currentUserId });
    if (!familyId || !currentUserId) {
      console.log('⚠️ Missing familyId or currentUserId, skipping load');
      setLoading(false);
      return;
    }
    
    // Load welcome message from localStorage
    const savedMessage = localStorage.getItem(`welcomeMessage_${familyId}`);
    if (savedMessage) {
      setWelcomeMessage(savedMessage);
    }
    
    // Update online status
    familyService.updateOnlineStatus(currentUserId, true).catch(console.error);
    
    // Subscribe to real-time family members updates (including online status)
    console.log('📡 Setting up real-time family members subscription...');
    const unsubscribe = familyService.subscribeToFamilyMembers(familyId, (members) => {
      console.log('📡 Real-time update received:', members.length, 'members');
      
      // Filter out current user and convert to contacts
      const contactsList: Contact[] = members
        .filter(member => member.id !== currentUserId)
        .map(member => ({
          id: member.id,
          name: member.displayName,
          type: member.role,
          isOnline: member.isOnline || false,
          gender: member.gender || null
        }));
      
      console.log('✅ Updated contacts:', contactsList.length, 'contacts');
      setContacts(contactsList);
      setLoading(false);
    });
    
    // Update online status on disconnect
    return () => {
      console.log('🧹 Cleaning up family members subscription');
      unsubscribe();
      familyService.updateOnlineStatus(currentUserId, false).catch(console.error);
    };
  }, [familyId, currentUserId]);

  // Listen for socket connect/disconnect to update online status
  useEffect(() => {
    const handleConnect = () => {
      console.log('✅ Socket connected in BubbleHome');
      setSocketConnected(true);
      // Get transport info if available
      const socket = (socketService as any).socket;
      if (socket?.io?.engine?.transport) {
        const transport = socket.io.engine.transport.name;
        setSocketTransport(transport);
        console.log('📡 Socket transport:', transport);
      }
      familyService.updateOnlineStatus(currentUserId, true).catch(console.error);
      // Real-time subscription will automatically update the UI
    };
    const handleDisconnect = (reason?: string) => {
      console.log('❌ Socket disconnected in BubbleHome:', reason);
      setSocketConnected(false);
      setConnectionError(reason || 'Disconnected');
      familyService.updateOnlineStatus(currentUserId, false).catch(console.error);
      // Real-time subscription will automatically update the UI
    };
    
    const handleConnectError = (error: Error) => {
      console.error('❌ Socket connection error in BubbleHome:', error);
      setConnectionError(error.message);
      setSocketConnected(false);
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);
    
    // Detect mobile
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();

    // Check initial connection state
    const checkConnection = () => {
      const connected = socketService.isConnected();
      console.log('🔍 Checking socket connection:', connected, 'SERVER_URL:', window.location.origin);
      setSocketConnected(connected);
      if (connected) {
        familyService.updateOnlineStatus(currentUserId, true).catch(console.error);
      } else {
        console.warn('⚠️ Socket is NOT connected. Check browser console for connection errors.');
        console.warn('⚠️ Make sure VITE_BACKEND_URL is set correctly in environment variables (Vercel/Render/etc).');
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Also check after a short delay to catch late connections
    const delayedCheck = setTimeout(() => {
      checkConnection();
    }, 1000);
    
    // Also check periodically in case we missed the event
    const connectionCheckInterval = setInterval(() => {
      checkConnection();
    }, 2000); // Check every 2 seconds

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      clearInterval(connectionCheckInterval);
      clearTimeout(delayedCheck);
    };
  }, [currentUserId]);


  // Sort: parents first, then children, then by online status
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.type === 'parent' && b.type !== 'parent') return -1;
    if (a.type !== 'parent' && b.type === 'parent') return 1;
    // Online users first
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return 0;
  });

  // Calculate dynamic bubble sizes based on number of contacts
  const calculateBubbleSize = (contact: Contact, totalContacts: number): number => {
    const isParentContact = contact.type === 'parent';
    const baseParentSize = 130;
    const baseChildSize = 90;
    
    // Scale down as more contacts are added
    // Formula: baseSize * (1 - (totalContacts - 1) * 0.05)
    // Minimum size: 60px for children, 80px for parents
    const scaleFactor = Math.max(0.4, 1 - (totalContacts - 1) * 0.05);
    
    if (isParentContact) {
      return Math.max(80, baseParentSize * scaleFactor);
    } else {
      return Math.max(60, baseChildSize * scaleFactor);
    }
  };

  // Check if two bubbles overlap
  const checkCollision = (
    x1: number, y1: number, size1: number,
    x2: number, y2: number, size2: number
  ): boolean => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const minDistance = (size1 + size2) / 2 + 10; // 10px padding
    return distance < minDistance;
  };

  // Find non-overlapping position - spread over entire screen
  const findNonOverlappingPosition = (
    existingPositions: Record<string, { x: number; y: number }>,
    contact: Contact,
    allContacts: Contact[],
    maxAttempts: number = 50
  ): { x: number; y: number } => {
    // Use entire viewport for positioning
    const isMobile = window.innerWidth < 768;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = isMobile ? 60 : 100; // Margin from screen edges
    const maxX = (viewportWidth / 2) - margin;
    const maxY = (viewportHeight / 2) - margin;
    
    const contactSize = calculateBubbleSize(contact, allContacts.length);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = (Math.random() - 0.5) * maxX * 2;
      const y = (Math.random() - 0.5) * maxY * 2;
      
      let hasCollision = false;
      for (const [otherId, otherPos] of Object.entries(existingPositions)) {
        const otherContact = allContacts.find(c => c.id === otherId);
        if (!otherContact) continue;
        
        const otherSize = calculateBubbleSize(otherContact, allContacts.length);
        if (checkCollision(x, y, contactSize, otherPos.x, otherPos.y, otherSize)) {
          hasCollision = true;
          break;
        }
      }
      
      if (!hasCollision) {
        return { x, y };
      }
    }
    
    // If no non-overlapping position found, return a position with slight offset
    return { x: (Math.random() - 0.5) * maxX * 2, y: (Math.random() - 0.5) * maxY * 2 };
  };

  // Initialize random positions for bubbles with collision avoidance
  useEffect(() => {
    if (sortedContacts.length === 0) return;
    
    const newPositions: Record<string, { x: number; y: number }> = {};
    
    sortedContacts.forEach(contact => {
      // If position already exists (from drag), keep it but check for collisions
      if (bubblePositions[contact.id]) {
        const existingPos = bubblePositions[contact.id];
        const contactSize = calculateBubbleSize(contact, sortedContacts.length);
        
        // Check if existing position causes collisions
        let hasCollision = false;
        for (const [otherId, otherPos] of Object.entries(newPositions)) {
          const otherContact = sortedContacts.find(c => c.id === otherId);
          if (!otherContact) continue;
          
          const otherSize = calculateBubbleSize(otherContact, sortedContacts.length);
          if (checkCollision(existingPos.x, existingPos.y, contactSize, otherPos.x, otherPos.y, otherSize)) {
            hasCollision = true;
            break;
          }
        }
        
        if (!hasCollision) {
          newPositions[contact.id] = existingPos;
        } else {
          // Find new position if existing one causes collision
          newPositions[contact.id] = findNonOverlappingPosition(newPositions, contact, sortedContacts);
        }
      } else {
        // Find new non-overlapping position
        newPositions[contact.id] = findNonOverlappingPosition(newPositions, contact, sortedContacts);
      }
    });
    
    setBubblePositions(newPositions);
  }, [sortedContacts.length, sortedContacts]); // Reinitialize when contacts change

  const handleBubbleClick = (contact: Contact, e?: React.MouseEvent) => {
    // If dragging, don't handle click
    if (draggedBubbleId) return;
    
    // For children: always call directly
    if (!isParent) {
      onCallContact(contact.id, contact.name, contact.type);
      return;
    }
    
    // For parents clicking on children: show modal with options
    if (isParent && contact.type === 'child') {
      e?.preventDefault();
      e?.stopPropagation();
      setSelectedChild(contact);
    } else {
      // For parents clicking on other parents: call directly
      onCallContact(contact.id, contact.name, contact.type);
    }
  };

  // Drag handlers - work over entire screen, smoother
  useEffect(() => {
    let animationFrameId: number | null = null;
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggedBubbleId || !dragOffset) {
        setIsOverDeleteZone(false);
        return;
      }
      
      // Cancel previous animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Use requestAnimationFrame for smoother dragging
      animationFrameId = requestAnimationFrame(() => {
        // Use viewport coordinates instead of container
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Calculate position relative to viewport center
        let x = e.clientX - viewportWidth / 2 - dragOffset.x;
        let y = e.clientY - viewportHeight / 2 - dragOffset.y;
        
        // Check if over delete zone (red cross)
        const deleteZone = document.querySelector('[data-delete-zone]') as HTMLElement;
        if (deleteZone) {
          const deleteZoneRect = deleteZone.getBoundingClientRect();
          const isOver = e.clientX >= deleteZoneRect.left && 
                         e.clientX <= deleteZoneRect.right &&
                         e.clientY >= deleteZoneRect.top && 
                         e.clientY <= deleteZoneRect.bottom;
          setIsOverDeleteZone(isOver);
        }
        
        // Get dragged contact and its size
        const draggedContact = sortedContacts.find(c => c.id === draggedBubbleId);
        if (!draggedContact) return;
        
        const draggedSize = calculateBubbleSize(draggedContact, sortedContacts.length);
        
        // Constrain to viewport bounds (accounting for bubble size)
        const maxX = viewportWidth / 2 - draggedSize / 2 - 50;
        const maxY = viewportHeight / 2 - draggedSize / 2 - 50;
        x = Math.max(-maxX, Math.min(maxX, x));
        y = Math.max(-maxY, Math.min(maxY, y));
        
        // Check for collisions with other bubbles and push away
        const currentPositions = { ...bubblePositions };
        let finalX = x;
        let finalY = y;
        
        for (const [otherId, otherPos] of Object.entries(currentPositions)) {
          if (otherId === draggedBubbleId) continue;
          
          const otherContact = sortedContacts.find(c => c.id === otherId);
          if (!otherContact) continue;
          
          const otherSize = calculateBubbleSize(otherContact, sortedContacts.length);
          
          if (checkCollision(finalX, finalY, draggedSize, otherPos.x, otherPos.y, otherSize)) {
            // Calculate push away direction
            const dx = finalX - otherPos.x;
            const dy = finalY - otherPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              const minDistance = (draggedSize + otherSize) / 2 + 10;
              
              finalX = otherPos.x + (dx / distance) * minDistance;
              finalY = otherPos.y + (dy / distance) * minDistance;
              
              // Constrain again after push
              finalX = Math.max(-maxX, Math.min(maxX, finalX));
              finalY = Math.max(-maxY, Math.min(maxY, finalY));
            }
          }
        }
        
        setBubblePositions(prev => ({
          ...prev,
          [draggedBubbleId]: { x: finalX, y: finalY }
        }));
      });
    };

    const handleGlobalMouseUp = () => {
      // If dropped over delete zone, delete the child
      if (draggedBubbleId && isOverDeleteZone) {
        const contact = sortedContacts.find(c => c.id === draggedBubbleId);
        if (contact && contact.type === 'child' && isParent) {
          handleDeleteChild(contact.id, contact.name);
        }
      }
      
      setDraggedBubbleId(null);
      setDragOffset(null);
      setIsOverDeleteZone(false);
    };

    if (draggedBubbleId) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggedBubbleId, dragOffset, isOverDeleteZone, sortedContacts, isParent]);

  // Close child modal when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (selectedChild) {
        setSelectedChild(null);
      }
    };
    
    if (selectedChild) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [selectedChild]);

  const handleMouseDown = (e: React.MouseEvent, contactId: string) => {
    if (!isParent) return; // Only parents can drag
    
    // Don't prevent default immediately - let click work if it's not a drag
    const startTime = Date.now();
    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;
    let dragStarted = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moved = Math.abs(moveEvent.clientX - startX) > 5 || Math.abs(moveEvent.clientY - startY) > 5;
      if (moved && !dragStarted) {
        hasMoved = true;
        dragStarted = true;
        // User is dragging, start drag operation
        e.preventDefault();
        e.stopPropagation();
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const currentPos = bubblePositions[contactId] || { x: 0, y: 0 };
        
        const offsetX = moveEvent.clientX - (viewportWidth / 2 + currentPos.x);
        const offsetY = moveEvent.clientY - (viewportHeight / 2 + currentPos.y);
        
        setDraggedBubbleId(contactId);
        setDragOffset({ x: offsetX, y: offsetY });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      const elapsed = Date.now() - startTime;
      const moved = Math.abs(upEvent.clientX - startX) > 5 || Math.abs(upEvent.clientY - startY) > 5;
      
      // If it was a quick click (not a drag), don't prevent the click event
      if (elapsed < 300 && !moved && !hasMoved && !dragStarted) {
        // Let the onClick handler handle it
        // Don't prevent default or stop propagation
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRequestNewCode = () => {
    if (confirm('Wil je een nieuwe code aanvragen? Je wordt uitgelogd en moet een nieuwe code van papa of mama krijgen.')) {
      localStorage.removeItem('childSession');
      window.location.reload();
    }
  };

  const handleLogout = () => {
    const message = isParent 
      ? 'Weet je zeker dat je wilt uitloggen?'
      : 'Weet je zeker dat je wilt uitloggen?';
    
    if (confirm(message)) {
      if (isParent) {
        firebaseService.logout();
      } else {
        localStorage.removeItem('childSession');
        window.location.reload();
      }
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!isParent) return;
    
    // Show modal instead of confirm
    setDeleteModal({ childId, childName });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    const { childId, childName } = deleteModal;

    try {
      setDeletingChildId(childId);
      await familyService.deleteChild(childId, currentUserId);
      
      // Reload contacts to reflect deletion
      // Real-time subscription will automatically update the UI
      
      // Close modal
      setDeleteModal(null);
      setDeletingChildId(null);
      
      // Show success message
      setTimeout(() => {
        alert(`✅ ${childName} is succesvol verwijderd.`);
      }, 100);
    } catch (error) {
      console.error('Error deleting child:', error);
      alert(`❌ Fout bij verwijderen: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
      setDeletingChildId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModal(null);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #2196F3',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#666' }}>Familie laden...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: window.innerWidth < 768 ? '0.5rem' : '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Animated background circles */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        top: '-100px',
        left: '-100px',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        bottom: '-50px',
        right: '-50px',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />

      {/* Connection status indicator - clickable, smaller */}
      <div 
        onClick={() => setShowConnectionDetails(!showConnectionDetails)}
        style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: socketConnected ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '14px',
          fontSize: '11px',
          fontWeight: '600',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          zIndex: 100
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <div style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: 'white',
          animation: socketConnected ? 'pulse 2s ease-in-out infinite' : 'none'
        }} />
        {socketConnected ? 'Verbonden' : 'Niet verbonden'}
      </div>

      {/* Connection details popup */}
      {showConnectionDetails && (
        <div
          onClick={() => setShowConnectionDetails(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '300px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
              Verbindingsstatus
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                <strong>Status:</strong> {socketConnected ? '✅ Verbonden' : '❌ Niet verbonden'}
              </p>
              {socketTransport !== 'unknown' && (
                <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                  <strong>Transport:</strong> {socketTransport}
                </p>
              )}
              {isMobile && (
                <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                  <strong>Device:</strong> Mobiel ({/Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iOS' : 'Mobile'})
                </p>
              )}
              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                <strong>Backend URL:</strong> {import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:4000' : `http://${window.location.hostname}:4000`)}
              </p>
              {connectionError && (
                <div style={{ margin: '0.5rem 0', padding: '0.5rem', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                  <p style={{ margin: 0, color: '#c62828', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    ⚠️ Error: {connectionError}
                  </p>
                </div>
              )}
              {!socketConnected && (
                <div style={{ margin: '0.5rem 0', color: '#f44336', fontSize: '0.85rem' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    ⚠️ Backend niet bereikbaar
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>
                    • Controleer of de backend server draait
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>
                    • Check VITE_BACKEND_URL environment variable
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>
                    • Controleer CORS instellingen op de server
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>
                    • Open browser console (F12) voor details
                  </p>
                </div>
              )}
              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                <strong>User ID:</strong> {currentUserId.substring(0, 20)}...
              </p>
              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                <strong>Familie ID:</strong> {familyId}
              </p>
            </div>
            <button
              onClick={() => setShowConnectionDetails(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Welcome message - better positioned */}
      <h1 
        onClick={isParent ? () => {
          const newMessage = prompt('Welkom tekst aanpassen:', welcomeMessage);
          if (newMessage !== null && newMessage.trim()) {
            setWelcomeMessage(newMessage.trim());
            // Save to localStorage
            localStorage.setItem(`welcomeMessage_${familyId}`, newMessage.trim());
          }
        } : undefined}
        style={{
          marginTop: window.innerWidth < 768 ? '60px' : '80px',
          marginBottom: window.innerWidth < 768 ? '0.5rem' : '0.75rem',
          fontSize: window.innerWidth < 768 ? '1.5rem' : '2.2rem',
          color: 'white',
          textAlign: 'center',
          fontFamily: 'system-ui',
          textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          fontWeight: '700',
          zIndex: 10,
          position: 'relative',
          cursor: isParent ? 'pointer' : 'default',
          opacity: isParent ? 0.95 : 1,
          transition: isParent ? 'opacity 0.2s' : 'none'
        }}
        onMouseEnter={isParent ? (e) => {
          e.currentTarget.style.opacity = '1';
        } : undefined}
        onMouseLeave={isParent ? (e) => {
          e.currentTarget.style.opacity = '0.95';
        } : undefined}
        title={isParent ? 'Klik om aan te passen' : undefined}
      >
        {isParent ? welcomeMessage : `Welkom, ${currentUserName}!`}
      </h1>
      
      <p style={{
        marginBottom: window.innerWidth < 768 ? '1rem' : '1.25rem',
        fontSize: window.innerWidth < 768 ? '0.9rem' : '1.1rem',
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.2)',
        zIndex: 10,
        position: 'relative'
      }}>
        {isParent ? 'Mijn Familie' : 'Wie wil je bellen?'}
      </p>

      {/* Bubbles container - full screen */}
      <div 
        data-bubble-container
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: draggedBubbleId ? 'grabbing' : 'default',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {sortedContacts.length === 0 ? (
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: '3rem',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👨‍👩‍👧‍👦</div>
            <p style={{ color: '#666', fontSize: '1.2rem', margin: 0 }}>
              {isParent ? 'Nog geen familie leden. Voeg een kind toe!' : 'Nog geen familie leden.'}
            </p>
          </div>
        ) : (
          sortedContacts.map((contact, index) => {
            const isParentContact = contact.type === 'parent';
            const size = calculateBubbleSize(contact, sortedContacts.length);
            const canCall = contact.isOnline || isParent;
            
            // Get position from state or use default
            const position = bubblePositions[contact.id] || { x: 0, y: 0 };
            const x = position.x;
            const y = position.y;
            
            const isDragging = draggedBubbleId === contact.id;

            return (
              <div
                key={contact.id}
                style={{
                  position: 'absolute',
                  left: `calc(50vw + ${x}px)`,
                  top: `calc(50vh + ${y}px)`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  animation: canCall && !isDragging ? 'float 3s ease-in-out infinite' : 'none',
                  animationDelay: `${index * 0.2}s`,
                  cursor: isParent ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  zIndex: isDragging ? 1000 : 1,
                  pointerEvents: 'auto',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                onMouseDown={(e) => handleMouseDown(e, contact.id)}
              >
                {/* Bubble - Soap bubble effect */}
                <div
                  onClick={(e) => {
                    if (!isDragging) {
                      // Handle click for both parents and children
                      handleBubbleClick(contact, e);
                    }
                  }}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    background: canCall
                      ? (isParentContact 
                          ? `radial-gradient(circle at 30% 30%, 
                              rgba(255,255,255,0.8) 0%,
                              rgba(255,255,255,0.4) 20%,
                              rgba(102, 126, 234, 0.3) 40%,
                              rgba(118, 75, 162, 0.4) 60%,
                              rgba(240, 147, 251, 0.3) 80%,
                              rgba(102, 126, 234, 0.2) 100%)` 
                          : `radial-gradient(circle at 30% 30%, 
                              rgba(255,255,255,0.8) 0%,
                              rgba(255,255,255,0.4) 20%,
                              rgba(79, 172, 254, 0.3) 40%,
                              rgba(0, 242, 254, 0.4) 60%,
                              rgba(67, 233, 123, 0.3) 80%,
                              rgba(79, 172, 254, 0.2) 100%)`)
                      : `radial-gradient(circle at 30% 30%, 
                          rgba(255,255,255,0.3) 0%,
                          rgba(200,200,200,0.2) 50%,
                          rgba(150,150,150,0.3) 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canCall && !isDragging ? 'pointer' : (isDragging ? 'grabbing' : 'not-allowed'),
                    boxShadow: canCall
                      ? `0 0 ${size * 0.4}px rgba(${isParentContact ? '102, 126, 234' : '79, 172, 254'}, 0.4),
                         0 0 ${size * 0.6}px rgba(${isParentContact ? '118, 75, 162' : '0, 242, 254'}, 0.3),
                         0 8px 32px rgba(0,0,0,0.2),
                         inset -${size * 0.15}px -${size * 0.15}px ${size * 0.3}px rgba(0,0,0,0.1),
                         inset ${size * 0.2}px ${size * 0.2}px ${size * 0.4}px rgba(255,255,255,0.5)`
                      : '0 4px 10px rgba(0,0,0,0.2)',
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s, filter 0.3s',
                    opacity: canCall ? 0.9 : 0.5,
                    border: canCall 
                      ? `2px solid rgba(255,255,255,0.6)` 
                      : '2px solid rgba(150,150,150,0.5)',
                    animation: canCall && !isDragging ? 'bubbleFloat 4s ease-in-out infinite, bubbleShimmer 3s ease-in-out infinite' : 'none',
                    animationDelay: `${index * 0.2}s`,
                    position: 'relative',
                    filter: canCall ? 'brightness(1.05) saturate(1.1)' : 'brightness(0.7)',
                    backdropFilter: 'blur(20px)',
                    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                    pointerEvents: isDragging ? 'none' : 'auto'
                  }}
                  onMouseEnter={(e) => {
                    if (canCall && !isDragging) {
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.filter = 'brightness(1.15) saturate(1.2)';
                      e.currentTarget.style.boxShadow = canCall
                        ? `0 0 ${size * 0.6}px rgba(${isParentContact ? '102, 126, 234' : '79, 172, 254'}, 0.6),
                           0 0 ${size * 0.8}px rgba(${isParentContact ? '118, 75, 162' : '0, 242, 254'}, 0.4),
                           0 12px 40px rgba(0,0,0,0.3),
                           inset -${size * 0.15}px -${size * 0.15}px ${size * 0.3}px rgba(0,0,0,0.1),
                           inset ${size * 0.25}px ${size * 0.25}px ${size * 0.5}px rgba(255,255,255,0.6)`
                        : '0 4px 10px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.filter = canCall ? 'brightness(1.05) saturate(1.1)' : 'brightness(0.7)';
                      e.currentTarget.style.boxShadow = canCall
                        ? `0 0 ${size * 0.4}px rgba(${isParentContact ? '102, 126, 234' : '79, 172, 254'}, 0.4),
                           0 0 ${size * 0.6}px rgba(${isParentContact ? '118, 75, 162' : '0, 242, 254'}, 0.3),
                           0 8px 32px rgba(0,0,0,0.2),
                           inset -${size * 0.15}px -${size * 0.15}px ${size * 0.3}px rgba(0,0,0,0.1),
                           inset ${size * 0.2}px ${size * 0.2}px ${size * 0.4}px rgba(255,255,255,0.5)`
                        : '0 4px 10px rgba(0,0,0,0.2)';
                    }
                  }}
                >
                  {/* Soap bubble highlight/reflection */}
                  <div style={{
                    position: 'absolute',
                    top: '15%',
                    left: '25%',
                    width: `${size * 0.35}px`,
                    height: `${size * 0.35}px`,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    filter: 'blur(2px)',
                    pointerEvents: 'none'
                  }} />
                  
                  {/* Secondary reflection */}
                  <div style={{
                    position: 'absolute',
                    top: '45%',
                    left: '60%',
                    width: `${size * 0.2}px`,
                    height: `${size * 0.2}px`,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)',
                    filter: 'blur(1px)',
                    pointerEvents: 'none'
                  }} />
                  {/* Avatar - emoji based on gender, or initials if no gender */}
                  <div style={{
                    fontSize: isParentContact ? '3.5rem' : '2.5rem',
                    fontWeight: 'normal',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                    transition: 'transform 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {contact.avatar && contact.avatar.startsWith('http') ? (
                      <img 
                        src={contact.avatar} 
                        alt={contact.name}
                        style={{
                          width: isParentContact ? '56px' : '40px',
                          height: isParentContact ? '56px' : '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid rgba(255,255,255,0.5)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                      />
                    ) : (
                      <span style={{
                        fontSize: isParentContact ? '3.5rem' : '2.5rem',
                        fontWeight: contact.gender ? 'normal' : 'bold',
                        color: contact.gender ? 'inherit' : 'white',
                        textShadow: contact.gender ? 'none' : '0 2px 8px rgba(0,0,0,0.4)'
                      }}>
                        {isParentContact 
                          ? '👨' 
                          : contact.gender === 'boy' 
                            ? '👦' 
                            : contact.gender === 'girl' 
                              ? '👧' 
                              : contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Online indicator - futuristisch */}
                  {canCall && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #4CAF50 0%, #2e7d32 100%)',
                      border: '2px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 0 10px rgba(76, 175, 80, 0.8), 0 0 20px rgba(76, 175, 80, 0.4)',
                      animation: 'pulse 2s ease-in-out infinite'
                    }} />
                  )}

                  {/* Offline indicator */}
                  {!canCall && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#999',
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }} />
                  )}

                  {/* Name label */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'white',
                    textShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    padding: '4px 12px',
                    borderRadius: '12px'
                  }}>
                    {contact.name}
                  </div>
                </div>

              </div>
            );
          })
        )}
        
        {/* Delete Zone - Red cross appears when dragging a child bubble, glows when hovered */}
        {isParent && draggedBubbleId && sortedContacts.find(c => c.id === draggedBubbleId)?.type === 'child' && (
          <div
            data-delete-zone
            style={{
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: isOverDeleteZone 
                ? 'rgba(244, 67, 54, 0.95)' 
                : 'rgba(244, 67, 54, 0.7)',
              border: `3px solid ${isOverDeleteZone ? 'white' : 'rgba(255,255,255,0.8)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'not-allowed',
              boxShadow: isOverDeleteZone 
                ? '0 0 40px rgba(244, 67, 54, 1), 0 0 60px rgba(244, 67, 54, 0.6), 0 8px 24px rgba(0,0,0,0.4)' 
                : '0 4px 16px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              transform: isOverDeleteZone ? 'scale(1.2)' : 'scale(1)',
              zIndex: 10000,
              animation: isOverDeleteZone ? 'deleteGlow 1s ease-in-out infinite' : 'none',
              pointerEvents: 'none'
            }}
          >
            ×
          </div>
        )}
      </div>

      {/* New Code Modal */}
      {newCodeForChild && (
        <div
          onClick={() => setNewCodeForChild(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease',
              textAlign: 'center'
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
              🔑 Nieuwe Code
            </h2>
            <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '1rem' }}>
              De nieuwe code voor {selectedChild?.name || 'dit kind'} is:
            </p>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: '#2196F3',
              letterSpacing: '0.5rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '12px',
              fontFamily: 'monospace'
            }}>
              {newCodeForChild.code}
            </div>
            <p style={{ marginBottom: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
              Deze code is 24 uur geldig. Deel deze code met het kind om in te loggen.
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newCodeForChild.code).then(() => {
                  alert('Code gekopieerd naar klembord!');
                }).catch(() => {
                  alert('Kon code niet kopiëren. Code: ' + newCodeForChild.code);
                });
              }}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '0.5rem'
              }}
            >
              📋 Code Kopiëren
            </button>
            <button
              onClick={() => setNewCodeForChild(null)}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Child Detail Modal for Parents */}
      {selectedChild && (
        <div
          onClick={() => setSelectedChild(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '3rem 2rem 2rem',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease',
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedChild(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d0d0d0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              }}
            >
              ×
            </button>

            {/* Profile Photo/Avatar - Large */}
            <div style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `radial-gradient(circle at 30% 30%, 
                rgba(255,255,255,0.8) 0%,
                rgba(255,255,255,0.4) 20%,
                rgba(79, 172, 254, 0.3) 40%,
                rgba(0, 242, 254, 0.4) 60%,
                rgba(67, 233, 123, 0.3) 80%,
                rgba(79, 172, 254, 0.2) 100%)`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              border: '4px solid rgba(255,255,255,0.8)'
            }}>
              {selectedChild.avatar && selectedChild.avatar.startsWith('http') ? (
                <img 
                  src={selectedChild.avatar} 
                  alt={selectedChild.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <span style={{
                  fontSize: '5rem',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                }}>
                  {selectedChild.gender === 'boy' 
                    ? '👦' 
                    : selectedChild.gender === 'girl' 
                      ? '👧' 
                      : selectedChild.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name - Large */}
            <h2 style={{
              margin: '0 0 1rem 0',
              fontSize: '2rem',
              fontWeight: '700',
              color: '#333',
              flexShrink: 0
            }}>
              {selectedChild.name}
            </h2>

            {/* Online Status */}
            {selectedChild.isOnline && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#e8f5e9',
                borderRadius: '20px',
                marginBottom: '1.5rem',
                fontSize: '14px',
                color: '#2e7d32',
                fontWeight: '500',
                flexShrink: 0
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#4CAF50',
                  animation: 'pulse 2s ease-in-out infinite'
                }} />
                Online
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: 'auto',
              paddingTop: '2rem'
            }}>
              <button
                onClick={() => {
                  onCallContact(selectedChild.id, selectedChild.name, selectedChild.type);
                  setSelectedChild(null);
                }}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1976D2';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2196F3';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
                }}
              >
                <span style={{ fontSize: '20px' }}>📞</span>
                <span>Bellen</span>
              </button>
              
              <button
                onClick={async () => {
                  try {
                    const childInfo = await familyService.getUserInfo(selectedChild.id);
                    if (!childInfo) {
                      alert('Kon kind informatie niet ophalen');
                      return;
                    }
                    const code = await familyService.generateChildCode(
                      familyId,
                      childInfo.displayName,
                      currentUserId,
                      childInfo.gender || null
                    );
                    setNewCodeForChild({ childId: selectedChild.id, code });
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Kon code niet genereren');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F57C00';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 152, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FF9800';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.3)';
                }}
              >
                <span style={{ fontSize: '20px' }}>🔑</span>
                <span>Nieuwe Code Genereren</span>
              </button>
              
              <button
                onClick={() => {
                  handleDeleteChild(selectedChild.id, selectedChild.name);
                  setSelectedChild(null);
                }}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#d32f2f';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(244, 67, 54, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f44336';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.3)';
                }}
              >
                <span style={{ fontSize: '20px' }}>🗑️</span>
                <span>Verwijderen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { 
            transform: translate(-50%, -50%) translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translate(-50%, -50%) translateY(-20px) rotate(3deg); 
          }
        }
        @keyframes bubbleFloat {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          33% { 
            transform: translateY(-15px) rotate(2deg); 
          }
          66% { 
            transform: translateY(-8px) rotate(-2deg); 
          }
        }
        @keyframes bubbleShimmer {
          0%, 100% { 
            filter: brightness(1.05) saturate(1.1) hue-rotate(0deg);
          }
          50% { 
            filter: brightness(1.1) saturate(1.15) hue-rotate(5deg);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        @keyframes deleteGlow {
          0%, 100% { 
            box-shadow: 0 0 40px rgba(244, 67, 54, 1), 
                        0 0 60px rgba(244, 67, 54, 0.6), 
                        0 8px 24px rgba(0,0,0,0.4);
          }
          50% { 
            box-shadow: 0 0 60px rgba(244, 67, 54, 1), 
                        0 0 90px rgba(244, 67, 54, 0.8), 
                        0 12px 32px rgba(0,0,0,0.5);
          }
        }
        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.5), 
                        0 10px 40px rgba(0,0,0,0.4),
                        inset 0 0 20px rgba(255,255,255,0.2);
          }
          50% { 
            box-shadow: 0 0 35px rgba(102, 126, 234, 0.7), 
                        0 15px 50px rgba(0,0,0,0.5),
                        inset 0 0 30px rgba(255,255,255,0.3);
          }
        }
      `}</style>


      {/* Settings button for parents - icon only, smaller */}
      {isParent && (
        <>
          <button
            onClick={() => setShowAddChildModal(true)}
            style={{
              position: 'absolute',
              top: '15px',
              right: '105px',
              width: '32px',
              height: '32px',
              padding: '0',
              backgroundColor: 'rgba(33, 150, 243, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }}
            title="Kind toevoegen"
          >
            +
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              position: 'absolute',
              top: '15px',
              right: '60px',
              width: '32px',
              height: '32px',
              padding: '0',
              backgroundColor: 'rgba(102, 126, 234, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }}
            title="Instellingen"
          >
            ⚙️
          </button>
        </>
      )}

      {/* Logout button - smaller, with arrow */}
      <button
        onClick={handleLogout}
        style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          width: '32px',
          height: '32px',
          padding: '0',
          backgroundColor: 'rgba(244, 67, 54, 0.9)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: '600',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }}
        title="Uitloggen"
      >
        →
      </button>

      {/* Request New Code button for children */}
      {!isParent && (
        <button
          onClick={handleRequestNewCode}
          style={{
            position: 'absolute',
            top: '15px',
            right: '55px',
            width: '32px',
            height: '32px',
            padding: '0',
            backgroundColor: 'rgba(255, 152, 0, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          }}
          title="Nieuwe code aanvragen"
        >
          🔑
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          onClick={cancelDelete}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease'
            }}
          >
            <h2 style={{
              marginTop: 0,
              marginBottom: '1rem',
              color: '#333',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              ⚠️ Kind Verwijderen
            </h2>
            
            <p style={{
              marginBottom: '1.5rem',
              color: '#666',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              Weet je zeker dat je <strong>{deleteModal.childName}</strong> wilt verwijderen?
            </p>
            
            <p style={{
              marginBottom: '1.5rem',
              color: '#999',
              fontSize: '0.9rem',
              lineHeight: '1.4'
            }}>
              Het account wordt definitief verwijderd en het kind wordt automatisch uitgelogd.
            </p>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelDelete}
                disabled={deletingChildId === deleteModal.childId}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e0e0e0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deletingChildId === deleteModal.childId ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (deletingChildId !== deleteModal.childId) {
                    e.currentTarget.style.backgroundColor = '#d0d0d0';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }}
              >
                Annuleren
              </button>
              
              <button
                onClick={confirmDelete}
                disabled={deletingChildId === deleteModal.childId}
                style={{
                  padding: '10px 20px',
                  backgroundColor: deletingChildId === deleteModal.childId ? '#999' : '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deletingChildId === deleteModal.childId ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (deletingChildId !== deleteModal.childId) {
                    e.currentTarget.style.backgroundColor = '#d32f2f';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = deletingChildId === deleteModal.childId ? '#999' : '#f44336';
                }}
              >
                {deletingChildId === deleteModal.childId ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {showAddChildModal && (
        <div
          onClick={() => setShowAddChildModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowAddChildModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d0d0d0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              }}
            >
              ×
            </button>

            <ChildCodeGenerator
              familyId={familyId}
              onCodeGenerated={() => {
                // Real-time subscription will automatically update the UI
                // Don't auto-close modal - let user copy/share code first
              }}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '2.5rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem'
            }}>
              <h2 style={{
                margin: 0,
                color: '#333',
                fontSize: '1.8rem',
                fontWeight: '700'
              }}>
                ⚙️ Instellingen
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#999';
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {/* Family Info Section */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <h3 style={{
                  marginTop: 0,
                  marginBottom: '1rem',
                  color: '#333',
                  fontSize: '1.2rem',
                  fontWeight: '600'
                }}>
                  👨‍👩‍👧‍👦 Familie Informatie
                </h3>
                <p style={{
                  margin: '0.5rem 0',
                  color: '#666',
                  fontSize: '0.95rem'
                }}>
                  <strong>Familie ID:</strong> {familyId}
                </p>
                <p style={{
                  margin: '0.5rem 0',
                  color: '#666',
                  fontSize: '0.95rem'
                }}>
                  <strong>Aantal leden:</strong> {sortedContacts.length + 1}
                </p>
              </div>

              {/* Account Section */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <h3 style={{
                  marginTop: 0,
                  marginBottom: '1rem',
                  color: '#333',
                  fontSize: '1.2rem',
                  fontWeight: '600'
                }}>
                  👤 Account
                </h3>
                <div style={{
                  margin: '0.5rem 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <p style={{
                    margin: 0,
                    color: '#666',
                    fontSize: '0.95rem'
                  }}>
                    <strong>Naam:</strong> {currentUserName}
                  </p>
                  <button
                    onClick={async () => {
                      const newName = prompt('Nieuwe naam:', currentUserName);
                      if (newName && newName.trim() && newName.trim() !== currentUserName) {
                        try {
                          await familyService.updateDisplayName(currentUserId, newName.trim());
                          // Update local state
                          setCurrentUserName(newName.trim());
                          // Real-time subscription will automatically update the UI
                          alert('Naam succesvol aangepast!');
                        } catch (error) {
                          alert(error instanceof Error ? error.message : 'Kon naam niet aanpassen');
                        }
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Aanpassen
                  </button>
                </div>
                <p style={{
                  margin: '0.5rem 0',
                  color: '#666',
                  fontSize: '0.95rem'
                }}>
                  <strong>Rol:</strong> Ouder
                </p>
                <p style={{
                  margin: '0.5rem 0',
                  color: '#666',
                  fontSize: '0.95rem'
                }}>
                  <strong>Email:</strong> {firebaseService.getCurrentEmail() || '—'}
                </p>
              </div>

              {/* Actions Section */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <h3 style={{
                  marginTop: 0,
                  marginBottom: '1rem',
                  color: '#333',
                  fontSize: '1.2rem',
                  fontWeight: '600'
                }}>
                  🔧 Acties
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <button
                    onClick={async () => {
                      try {
                        await firebaseService.requestPasswordReset();
                        alert('Een wachtwoord-reset e-mail is verzonden. Controleer je inbox.');
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Kon reset e-mail niet verzenden');
                      }
                    }}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'background-color 0.2s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#5566d6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#667eea';
                    }}
                  >
                    <span>🔒</span>
                    <span>Wachtwoord vergeten</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddChildModal(true);
                      setShowSettingsModal(false);
                    }}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'background-color 0.2s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1976D2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2196F3';
                    }}
                  >
                    <span>➕</span>
                    <span>Kind toevoegen</span>
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'background-color 0.2s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#d32f2f';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f44336';
                    }}
                  >
                    <span>🚪</span>
                    <span>Uitloggen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
