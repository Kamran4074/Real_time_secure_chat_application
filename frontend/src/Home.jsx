import { useCallback, useState } from 'react';
import { useSignOut } from './features/auth';
import { Sidebar } from './features/contacts';
import { ChatWindow } from './features/chat';
import { ProfilePanel } from './features/settings';
import useConversation from './shared/store/useConversation';

// The logged-in screen: composes the features side by side.
// Mobile shows either the list or the open chat; desktop shows both.
const Home = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const [showProfile, setShowProfile] = useState(false);
  const signOut = useSignOut();
  const closeProfile = useCallback(() => setShowProfile(false), []);

  return (
    <div className='h-[100dvh] w-full bg-slate-100 md:p-4 lg:p-6'>
      <div className='mx-auto flex h-full max-w-7xl overflow-hidden bg-white md:rounded-2xl md:shadow-soft md:ring-1 md:ring-slate-200'>
        <aside className={`${selectedConversation ? 'hidden md:flex' : 'flex'}
          relative w-full shrink-0 flex-col border-r border-slate-200 md:w-[340px] lg:w-[380px]`}>
          {/* the profile drawer slides over the sidebar */}
          {showProfile && <ProfilePanel onClose={closeProfile} onSignedOut={signOut} />}
          <Sidebar onOpenProfile={() => setShowProfile(true)} />
        </aside>
        <section className={`${selectedConversation ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          <ChatWindow onBackUser={() => setSelectedConversation(null)} />
        </section>
      </div>
    </div>
  );
};

export default Home;
