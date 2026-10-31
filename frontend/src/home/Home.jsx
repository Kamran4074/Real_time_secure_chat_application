import Sidebar from './components/Sidebar';
import MessageContainer from './components/MessageContainer';
import useConversation from '../store/useConversation';

const Home = () => {
  const { selectedConversation, setSelectedConversation } = useConversation();

  // mobile: show either the list or the open chat; desktop: both side by side
  return (
    <div className='h-[100dvh] w-full bg-slate-100 md:p-4 lg:p-6'>
      <div className='mx-auto flex h-full max-w-7xl overflow-hidden bg-white md:rounded-2xl md:shadow-soft md:ring-1 md:ring-slate-200'>
        <aside className={`${selectedConversation ? 'hidden md:flex' : 'flex'}
          w-full shrink-0 flex-col border-r border-slate-200 md:w-[340px] lg:w-[380px]`}>
          <Sidebar />
        </aside>
        <section className={`${selectedConversation ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          <MessageContainer onBackUser={() => setSelectedConversation(null)} />
        </section>
      </div>
    </div>
  );
};

export default Home;
