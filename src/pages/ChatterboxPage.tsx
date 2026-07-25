import NavBar from '@/components/NavBar';
import { ChatterboxApp } from '@/chatterbox/ChatterboxApp';

const ChatterboxPage = () => {
  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(130% 70% at 20% 25%, hsl(199 89% 48% / 0.12), transparent 56%), ' +
              'radial-gradient(110% 65% at 80% 35%, hsl(199 89% 48% / 0.08), transparent 58%), ' +
              'radial-gradient(100% 80% at 50% 80%, hsl(220 28% 8% / 0.6), transparent 62%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <NavBar />

        <div className="flex-1 overflow-auto">
          <ChatterboxApp />
        </div>
      </div>
    </div>
  );
};

export default ChatterboxPage;
