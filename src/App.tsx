/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, ReactNode, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, House, Timer, Target, Award, Play, RefreshCw, ChevronRight, Volume2, VolumeX } from 'lucide-react';

// Use the generated assets
const ASSETS = {
  peppa: '/src/assets/images/peppa_pig_agent_1777100636293.png',
  george: '/src/assets/images/george_pig_agent_1777100649998.png',
  house: '/src/assets/images/peppa_house_agent_1777100669982.png',
  puddle: '/src/assets/images/muddy_puddle_agent_1777100685966.png',
};

const WORDS_DATA = [
  { text: '佩奇', pinyin: 'peiqi', english: 'peppa' },
  { text: '乔治', pinyin: 'qiaozhi', english: 'george' },
  { text: '恐龙', pinyin: 'konglong', english: 'dinosaur' },
  { text: '猪妈妈', pinyin: 'zhumama', english: 'mummy' },
  { text: '猪爸爸', pinyin: 'zhubaba', english: 'daddy' },
  { text: '泥坑', pinyin: 'nikeng', english: 'puddle' },
  { text: '靴子', pinyin: 'xuezi', english: 'boots' },
  { text: '下雨', pinyin: 'xiayu', english: 'rain' },
  { text: '太阳', pinyin: 'taiyang', english: 'sun' },
  { text: '小山', pinyin: 'xiaoshan', english: 'hill' },
  { text: '房子', pinyin: 'fangzi', english: 'house' },
  { text: '小鸭子', pinyin: 'xiaoyazi', english: 'duck' },
  { text: '自行车', pinyin: 'zixingche', english: 'bicycle' },
  { text: '气球', pinyin: 'qiqiu', english: 'balloon' },
  { text: '蛋糕', pinyin: 'dangao', english: 'cake' },
  { text: '派对', pinyin: 'paidui', english: 'party' },
  { text: '爷爷', pinyin: 'yeye', english: 'grandpa' },
  { text: '奶奶', pinyin: 'nainai', english: 'granny' },
  { text: '学校', pinyin: 'xuexiao', english: 'school' },
  { text: '校车', pinyin: 'xiaoche', english: 'bus' },
  { text: '野餐', pinyin: 'yecan', english: 'picnic' },
  { text: '苹果', pinyin: 'pingguo', english: 'apple' },
  { text: '草莓', pinyin: 'caomei', english: 'strawberry' },
  { text: '星星', pinyin: 'xingxing', english: 'stars' },
  { text: '医生', pinyin: 'yisheng', english: 'doctor' },
  { text: '消防车', pinyin: 'xiaofangche', english: 'engine' },
  { text: '花园', pinyin: 'huayuan', english: 'garden' }
];

interface FallingWord {
  id: string;
  text: string;
  pinyin: string;
  english: string;
  x: number;
  y: number;
  speed: number;
}

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'ended'>('start');
  const [gameMode, setGameMode] = useState<'chinese' | 'english'>('chinese');
  const [words, setWords] = useState<FallingWord[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [level, setLevel] = useState(1);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [totalTyped, setTotalTyped] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [lastSplash, setLastSplash] = useState<{ x: number, y: number } | null>(null);
  const [speedSetting, setSpeedSetting] = useState(0.8); // Default to a slower setting
  const [isMuted, setIsMuted] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const gameLoopRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const nextWordTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const spawnWord = useCallback(() => {
    const wordObj = WORDS_DATA[Math.floor(Math.random() * WORDS_DATA.length)];
    const id = Math.random().toString(36).substr(2, 9);
    const x = 15 + Math.random() * 70; // 15% to 85% width
    const speed = (0.1 + (level * 0.05) + Math.random() * 0.05) * speedSetting; 

    setWords(prev => [...prev, { id, ...wordObj, x, y: -10, speed }]);
  }, [level, speedSetting]);

  const startGame = () => {
    setGameState('playing');
    setWords([]);
    setScore(0);
    setProgress(0);
    setLevel(1);
    setWpm(0);
    setAccuracy(100);
    setTotalTyped(0);
    setMistakes(0);
    setInputValue('');
    startTimeRef.current = Date.now();
    nextWordTimeRef.current = 0;
    
    // Play music when game starts if not muted
    if (!isMuted && audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play prevented:", e));
    }
  };

  const endGame = () => {
    setGameState('ended');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().trim();
    setInputValue(e.target.value);

    // Check if any word matches
    const matchedWord = words.find(w => 
      gameMode === 'chinese' ? w.pinyin === value : w.english === value
    );

    if (matchedWord) {
      setWords(prev => prev.filter(w => w.id !== matchedWord.id));
      setInputValue('');
      setScore(s => s + matchedWord.text.length * 20);
      setTotalTyped(t => t + (gameMode === 'chinese' ? matchedWord.pinyin.length : matchedWord.english.length));
      setProgress(p => {
        const next = p + 4; // About 25 words to finish
        if (next >= 100) {
          setTimeout(endGame, 500);
          return 100;
        }
        return next;
      });
      setLastSplash({ x: matchedWord.x, y: matchedWord.y });
      setTimeout(() => setLastSplash(null), 600);

      // Level up logic
      if (score > level * 800) {
        setLevel(l => Math.min(l + 1, 10));
      }
    }
  };

  // Handle audio play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Audio play prevented:", e));
      }
    }
  }, [isMuted]);

  // Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = (time: number) => {
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Update word positions
      setWords(prev => {
        const updated = prev.map(w => ({ ...w, y: w.y + w.speed * (dt / 16) }));
        // Check if any word touched the bottom
        if (updated.some(w => w.y > 82)) {
          setMistakes(m => m + 1);
          return updated.filter(w => w.y <= 82);
        }
        return updated;
      });

      // Spawn new words
      if (time > nextWordTimeRef.current) {
        spawnWord();
        // Higher speedSetting means shorter interval
        const baseInterval = Math.max(3000, 6000 - level * 300);
        const interval = baseInterval / speedSetting;
        nextWordTimeRef.current = time + interval;
      }

      // Update WPM & Accuracy
      const timeElapsed = (Date.now() - startTimeRef.current) / 60000; // in minutes
      if (timeElapsed > 0.05) {
        setWpm(Math.round((totalTyped) / timeElapsed));
      }
      if (totalTyped + mistakes > 0) {
        setAccuracy(Math.round((totalTyped / (totalTyped + mistakes)) * 100));
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, spawnWord, level, totalTyped, mistakes]);

  return (
    <div className="min-h-screen bg-[#B3E5FC] font-sans selection:bg-pink-200 overflow-hidden relative">
      {/* Background - Sky and Hills */}
      <audio 
        ref={audioRef}
        src="https://www.chosic.com/wp-content/uploads/2021/04/Playful-Music.mp3" 
        loop
      />
      <div className="absolute inset-0 bg-[#B3E5FC] h-[60vh] overflow-hidden">
        <div className="absolute top-10 right-16 w-24 h-24 bg-[#FACC15] rounded-full shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-pulse" />
        
        <div className="absolute top-12 left-20 w-40 h-12 bg-white rounded-full opacity-90" />
        <div className="absolute top-16 left-32 w-28 h-12 bg-white rounded-full opacity-90" />
        
        <div className="absolute top-24 right-40 w-32 h-10 bg-white rounded-full opacity-80" />
        <div className="absolute top-28 right-52 w-20 h-10 bg-white rounded-full opacity-80" />
      </div>

      {/* Rolling Green Hill */}
      <div className="absolute bottom-[-150px] left-[-10%] w-[120%] h-[450px] bg-[#7CC04B] rounded-[100%] border-t-8 border-[#6BA840]"></div>

      {/* House on the Hill */}
      <motion.div 
        className="absolute bottom-[200px] right-[50px] w-48 z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <img src={ASSETS.house} alt="Peppa's House" className="w-full drop-shadow-xl" referrerPolicy="no-referrer" />
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full text-pink-500 font-bold border-2 border-pink-200">
          <House className="w-4 h-4" />
          <span>佩奇的家</span>
        </div>
      </motion.div>

      {/* Main Game Content */}
      <div className="relative z-30 container mx-auto px-4 h-screen flex flex-col">
        
        {/* Header Stats - Compact on smaller screens */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 py-4 lg:py-8 shrink-0 relative">
          <StatCard icon={<Timer className="text-white w-5 h-5 lg:w-6 lg:h-6" />} label="打字速度" value={`${wpm} 字/分`} theme="brown" />
          <StatCard icon={<Target className="text-white w-5 h-5 lg:w-6 lg:h-6" />} label="难度等级" value={level} theme="red" />
          <StatCard icon={<Award className="text-white w-5 h-5 lg:w-6 lg:h-6" />} label="游戏得分" value={score} theme="brown" />
          <StatCard icon={<Target className="text-[#FF4D4D] w-5 h-5 lg:w-6 lg:h-6" />} label="准确率" value={`${accuracy}%`} theme="white" />
          
          {/* Audio Toggle Button */}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="absolute -top-2 -right-2 lg:top-8 lg:-right-8 p-3 bg-white rounded-full shadow-lg border-2 border-pink-200 z-50 text-[#FF4D4D] hover:scale-110 transition-transform active:scale-95"
            title={isMuted ? "开启音乐" : "关闭音乐"}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        {/* Game Area */}
        <div className="flex-1 relative border-4 border-white/40 rounded-[40px] bg-white/10 backdrop-blur-sm overflow-hidden mb-4 min-h-[300px]">
          
          {gameState === 'start' && (
            <div className="absolute inset-0 flex flex-col items-center justify-start lg:justify-center text-center p-4 lg:p-8 bg-white/60 backdrop-blur-lg z-50 overflow-y-auto">
              <motion.img 
                src={ASSETS.peppa} 
                alt="Peppa" 
                className="w-24 lg:w-48 mb-2 lg:mb-6 drop-shadow-2xl shrink-0"
                animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                referrerPolicy="no-referrer"
              />
              <h1 className="text-3xl lg:text-7xl font-black text-[#FF4D4D] drop-shadow-md mb-2 lg:mb-4 tracking-tighter uppercase italic shrink-0">
                小猪佩奇 <span className="text-[#7CC04B]">跳泥坑!</span>
              </h1>
              <p className="text-base lg:text-2xl text-[#8D6E63] mb-4 lg:mb-8 max-w-md font-bold uppercase tracking-wide shrink-0">
                调节速度，准备好跳进泥坑了吗？
              </p>

              {/* Mode Selection */}
              <div className="flex gap-4 mb-6 shrink-0 scale-90 lg:scale-100">
                <button 
                  onClick={() => setGameMode('chinese')}
                  className={`px-6 py-3 rounded-full font-black transition-all ${gameMode === 'chinese' ? 'bg-[#7CC04B] text-white shadow-[0_4px_0_rgba(101,156,61,1)]' : 'bg-white text-[#7CC04B] border-2 border-[#7CC04B]'}`}
                >
                  拼音模式
                </button>
                <button 
                  onClick={() => setGameMode('english')}
                  className={`px-6 py-3 rounded-full font-black transition-all ${gameMode === 'english' ? 'bg-[#FF4D4D] text-white shadow-[0_4px_0_rgba(185,28,28,1)]' : 'bg-white text-[#FF4D4D] border-2 border-[#FF4D4D]'}`}
                >
                  英文模式
                </button>
              </div>

              {/* Speed Slider */}
              <div className="bg-white/95 p-6 lg:p-8 rounded-[30px] border-4 border-pink-200 shadow-xl mb-8 w-full max-w-md">
                <div className="flex justify-between items-center mb-4 font-black text-[#8D6E63] uppercase tracking-widest text-sm lg:text-lg">
                  <span>速度调节</span>
                  <span className="text-[#FF4D4D] text-lg lg:text-2xl">
                    {speedSetting < 0.6 ? '🐢 慢悠悠' : speedSetting < 1.2 ? '🚶 走路中' : speedSetting < 1.8 ? '🏃 跑步快' : '⚡ 飞毛腿'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.3" 
                  max="2.5" 
                  step="0.1" 
                  value={speedSetting}
                  onChange={(e) => setSpeedSetting(parseFloat(e.target.value))}
                  className="w-full h-3 lg:h-4 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-[#FF4D4D] hover:accent-red-600 transition-all"
                />
                <div className="flex justify-between mt-2 text-[10px] lg:text-xs font-black text-gray-400 tracking-tighter">
                  <span>非常慢</span>
                  <span>中等</span>
                  <span>非常快</span>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="group flex items-center gap-3 bg-[#FF4D4D] hover:bg-red-600 text-white px-10 py-5 lg:px-14 lg:py-7 rounded-full text-xl lg:text-4xl font-black shadow-[0_10px_0_rgba(185,28,28,1)] transition-all hover:translate-y-1 hover:shadow-[0_6px_0_rgba(185,28,28,1)] active:translate-y-2 active:shadow-none"
              >
                <Play className="w-8 h-8 lg:w-10 lg:h-10 fill-current" />
                开始游戏!
              </button>
            </div>
          )}


          {gameState === 'playing' && (
            <>
              {/* Falling Words */}
              <AnimatePresence>
                {words.map((word) => (
                  <motion.div
                    key={word.id}
                    className="absolute px-6 py-4 bg-white/95 backdrop-blur-sm rounded-[30px] shadow-2xl border-4 border-[#FFB6C1] flex flex-col items-center justify-center"
                    style={{ 
                      left: `${word.x}%`, 
                      top: `${word.y}%`,
                      transform: 'translateX(-50%)'
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                  >
                    <span className="text-sm font-black text-[#8D6E63] uppercase tracking-widest mb-1">
                      {gameMode === 'chinese' ? word.pinyin : word.english}
                    </span>
                    <span className="text-4xl font-black text-[#FF4D4D] tracking-widest italic">
                      {word.text}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Splash Animation */}
              {lastSplash && (
                <div 
                  className="absolute pointer-events-none"
                  style={{ left: `${lastSplash.x}%`, top: `${lastSplash.y + 5}%`, transform: 'translateX(-50%)' }}
                >
                  <img src={ASSETS.puddle} alt="Splash" className="w-48 animate-ping opacity-70" referrerPolicy="no-referrer" />
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                    <motion.span 
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -80 }}
                      className="text-4xl font-black text-[#8D6E63] italic uppercase tracking-tighter"
                    >
                      呼噜！啪嗒！
                    </motion.span>
                  </div>
                </div>
              )}

              {/* Peppa Character */}
              <motion.div 
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30"
                style={{ left: `${progress}%` }}
                animate={{ 
                  y: lastSplash ? [0, -100, 0] : [0, -10, 0],
                  rotate: lastSplash ? [0, 360, 0] : [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: lastSplash ? 0.5 : 2, 
                  repeat: lastSplash ? 0 : Infinity 
                }}
              >
                <img 
                  src={ASSETS.peppa} 
                  alt="Peppa" 
                  className="w-32 drop-shadow-2xl" 
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </>
          )}

          {gameState === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-start lg:justify-center text-center p-6 lg:p-8 bg-white/80 backdrop-blur-xl z-50 overflow-y-auto">
              <div className="w-24 h-24 lg:w-40 lg:h-40 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl border-8 border-white mb-6 lg:mb-8 animate-bounce">
                <Award className="w-16 h-16 lg:w-24 lg:h-24 text-white" />
              </div>
              <h2 className="text-4xl lg:text-7xl font-black text-[#FF4D4D] mb-2 uppercase italic tracking-tighter">太棒了!</h2>
              <p className="text-xl lg:text-3xl text-[#8D6E63] mb-8 lg:mb-12 font-bold uppercase tracking-widest">
                {progress >= 100 ? "你帮佩奇回到家啦！超级厉害！" : "这次练习进行得不错哦！"}
              </p>
              
              <div className="grid grid-cols-2 gap-4 lg:gap-8 mb-8 lg:mb-12 w-full max-w-lg">
                <div className="bg-[#8D6E63] p-4 lg:p-8 rounded-[32px] lg:rounded-[40px] border-4 lg:border-8 border-[#D7CCC8] shadow-2xl">
                  <div className="text-[10px] lg:text-sm text-white/70 uppercase font-black tracking-widest mb-1 lg:mb-2">得 分</div>
                  <div className="text-2xl lg:text-5xl font-black text-white">{score.toLocaleString()}</div>
                </div>
                <div className="bg-white p-4 lg:p-8 rounded-[32px] lg:rounded-[40px] border-4 lg:border-8 border-[#FF4D4D] shadow-2xl">
                  <div className="text-[10px] lg:text-sm text-[#FF4D4D]/70 uppercase font-black tracking-widest mb-1 lg:mb-2">打字速度</div>
                  <div className="text-2xl lg:text-5xl font-black text-[#FF4D4D]">{wpm} 字/分</div>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="flex items-center gap-4 bg-[#FF4D4D] hover:bg-red-600 text-white px-10 py-5 lg:px-14 lg:py-7 rounded-full text-xl lg:text-3xl font-black shadow-[0_10px_0_rgba(185,28,28,1)] transition-all hover:translate-y-1 hover:shadow-[0_6px_0_rgba(185,28,28,1)] active:translate-y-2 active:shadow-none"
              >
                <RefreshCw className="w-6 h-6 lg:w-8 lg:h-8" />
                再玩一次!
              </button>
            </div>
          )}
        </div>

        {/* Input Bar Section - Managed position */}
        <div className="h-32 lg:h-48 flex items-center justify-center shrink-0 mb-4">
          {gameState === 'playing' ? (
            <div className="max-w-3xl mx-auto w-full relative z-40">
              <div className="relative group scale-90 lg:scale-100">
                <input
                  autoFocus
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="w-full bg-white border-4 lg:border-8 border-[#8D6E63] rounded-full py-4 lg:py-8 px-10 lg:px-14 text-2xl lg:text-6xl font-black text-[#8D6E63] outline-none shadow-2xl placeholder:text-gray-200 transition-all focus:scale-[1.02]"
                  placeholder="点击这里输入文字..."
                />
                <div className="absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-16 lg:h-16 bg-[#FF4D4D] rounded-full flex items-center justify-center text-white text-xl lg:text-3xl font-bold shadow-lg">
                  ↵
                </div>
              </div>
              
              {/* Progress Bar - Integrated */}
              <div className="mt-4 px-8 scale-90 lg:scale-100">
                <div className="flex justify-between items-end mb-1 text-[#FF4D4D] font-black uppercase tracking-widest text-[10px] lg:text-sm">
                  <span>回家的距离</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-4 lg:h-8 bg-white/40 rounded-full border-2 lg:border-4 border-white overflow-hidden shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#FF4D4D] to-[#FFB6C1]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
             <div className="text-[#8D6E63]/40 font-black flex items-center gap-2 text-sm lg:text-xl uppercase tracking-widest pointer-events-none">
               准备好了吗？开始跳泥坑吧！
             </div>
          )}
        </div>
      </div>

      {/* Decorative George Pig - Background layer */}
      <motion.img 
        src={ASSETS.george} 
        alt="George" 
        className="absolute bottom-4 left-4 lg:bottom-12 lg:left-12 w-20 lg:w-40 drop-shadow-xl z-20 pointer-events-none opacity-80"
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function StatCard({ icon, label, value, theme }: { icon: ReactNode, label: string, value: string | number, theme: 'brown' | 'red' | 'white' }) {
  const styles = {
    brown: "bg-[#8D6E63] border-[#D7CCC8] text-white",
    red: "bg-[#FF4D4D] border-white text-white",
    white: "bg-white border-[#FF4D4D] text-[#FF4D4D]"
  };

  return (
    <div className={`${styles[theme]} p-6 rounded-[30px] border-4 shadow-xl flex flex-col items-center justify-center text-center transition-transform hover:scale-105 min-w-[140px]`}>
      <div className="mb-2 opacity-90">{icon}</div>
      <div className={`text-xs uppercase font-black tracking-[0.2em] mb-1 ${theme === 'white' ? 'text-[#FF4D4D]/60' : 'text-white/60'}`}>{label}</div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}
