import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  ChefHat,
  CalendarClock,
  Star,
  CheckCircle2,
  CalendarCheck,
  Clock,
  Compass,
  Lock,
  ShoppingBag,
  UserCheck,
  Award,
  ShieldCheck,
  BadgePercent,
  Sparkles,
} from 'lucide-react-native';
import API from '../../api/client';
import { consumePostAuthTarget } from '../../services/session';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { formatDate, isReviewable } from '../../utils/format';
import { Loader, ErrorBanner } from '../../components/feedback';
import { Button } from '../../components/Button';
import { LocationNotice } from '../../components/LocationNotice';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';

// Background of the offers band. The ticket notches are filled with this exact
// colour so they read as die-cut holes in the card, so the two must stay in sync.
const COUPON_BAND_BG = '#120b18';

// Curated Navratri / vrat dishes only, so the strip matches the festival the
// hero promotes. Grouped loosely as: sabudana, flours (kuttu/singhara/rajgira),
// samak & moraiyo, farali snacks, and vrat sweets.
const TICKER_DISHES = [
  'Sabudana Khichdi',
  'Sabudana Vada',
  'Sabudana Thalipeeth',
  'Sabudana Kheer',
  'Kuttu Paratha',
  'Kuttu Puri',
  'Kuttu Pakora',
  'Singhara Puri',
  'Rajgira Paratha',
  'Rajgira Ladoo',
  'Samak Rice',
  'Samak Khichdi',
  'Moraiyo Khichdi',
  'Farali Pattice',
  'Farali Chivda',
  'Vrat Ke Aloo',
  'Ratalyacha Kees',
  'Shakarkandi Chaat',
  'Vrat Ki Kadhi',
  'Makhana Kheer',
  'Roasted Makhana',
  'Banana Halwa',
];

const TESTIMONIALS = [
  {
    name: 'Ananya Deshpande',
    role: 'Host, Diwali Celebration in Pune',
    quote:
      'Priya ji made the crunchiest Chaklis and melt-in-mouth Karanjis for our Diwali party. Our guests could not stop praising the taste!',
    rating: 5,
    avatar: 'AD',
  },
  {
    name: 'Vikram Kulkarni',
    role: 'Ganesh Festival in Pune',
    quote:
      'Booking a cook for Modaks was the best decision we made. We learned the traditional pleating technique and enjoyed fresh steamed Ukadiche Modak.',
    rating: 5,
    avatar: 'VK',
  },
  {
    name: 'Rohit & Meera Sen',
    role: 'Navratri Feast Host',
    quote:
      'Finding an experienced fasting food specialist in minutes was magical. The Sabudana Khichdi and fruit salads were extraordinary!',
    rating: 5,
    avatar: 'RS',
  },
];

const HOW_STEPS = [
  {
    icon: Compass,
    step: '01',
    title: 'Share Requirements',
    text: 'Pick a service, date, dishes and location — tell us what you need for your gathering.',
  },
  {
    icon: UserCheck,
    step: '02',
    title: 'Pick Cook & Slot',
    text: 'See verified cooks free on your date with their open time slots — tap one to send your booking request.',
  },
  {
    icon: CalendarCheck,
    step: '03',
    title: 'OTP-Verified Start',
    text: 'Cook arrives at your home, you share the OTP — session starts securely with live tracking and UPI payment after approval.',
  },
  {
    icon: Award,
    step: '04',
    title: 'Savor & Review',
    text: 'Enjoy delicious authentic flavors with your family, then share your review and experience with the community.',
  },
];

// Trust chips shown directly under the hero CTA.
const HERO_PERKS = [
  { icon: ShieldCheck, label: '100% Verified Cooks' },
  { icon: CheckCircle2, label: 'OTP-Verified Start' },
  { icon: Lock, label: 'Secure UPI' },
];

const { width: SCREEN_W } = Dimensions.get('window');

const AUTOPLAY_MS = 3500;

// The rail connector fades from a strong brand orange at the top of the flow to
// a soft peach at the bottom, so the timeline reads as a single gradient rather
// than three flat segments.
const HOW_RAIL_TINTS = ['#fdba74', '#fcd0ab', '#fbe0c9'];

// Gradient-filled circular step marker with the step icon in white. Drawn with
// SVG so the nodes read as polished brand accents rather than flat orange dots.
const StepNode = ({ step, Icon }) => {
  const size = 46;
  const gradientId = `how-node-gradient-${step}`;
  return (
    <View style={styles.howNode}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fdba74" />
            <Stop offset="0.55" stopColor="#f97316" />
            <Stop offset="1" stopColor="#c2410c" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
      <Icon size={21} color="#fff" strokeWidth={2.2} />
    </View>
  );
};

// Small icon + label pill for coupon terms (min order, validity, etc.).
const MetaChip = ({ icon: Icon, label }) => (
  <View style={styles.meta}>
    {Icon ? <Icon size={11} color="#ffe08a" strokeWidth={2.2} /> : null}
    <Text style={styles.metaText}>{label}</Text>
  </View>
);

const DishCarousel = () => {
  const ref = useRef(null);
  const index = useRef(0);
  const timer = useRef(null);
  const slides = [
    { src: require('../../../assets/carousel-2.png'), name: 'Festive Specials' },
    { src: require('../../../assets/carousel-3.png'), name: 'Traditional Delights' },
  ];

  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const start = () => {
    stop();
    if (slides.length <= 1) return;
    timer.current = setInterval(() => {
      index.current = (index.current + 1) % slides.length;
      try {
        ref.current?.scrollTo({ x: index.current * (SCREEN_W - 32), animated: true });
      } catch {}
    }, AUTOPLAY_MS);
  };

  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.carousel}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onTouchStart={stop}
        onTouchEnd={start}
        onMomentumScrollEnd={(e) => {
          const w = SCREEN_W - 32;
          index.current = Math.min(
            Math.max(Math.round((e.nativeEvent.contentOffset.x || 0) / w), 0),
            slides.length - 1,
          );
          start();
        }}>
        {slides.map((s) => (
          <View key={s.name} style={styles.slide}>
            <Image source={s.src} style={styles.slideImg} resizeMode="cover" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// Marquee speed in points per second.
const TICKER_SPEED = 45;

// Auto-scrolling strip of dish names below the hero.
//
// The previous implementation advanced a ScrollView with setInterval +
// scrollTo({ animated: false }) every 50ms. Both platforms coalesce or drop
// rapid imperative scrollTo calls (iOS ignores an unanimated scrollTo issued
// while a scroll is already in flight), so the strip looked frozen and fought
// the outer vertical ScrollView. Driving a transform with the Animated native
// driver instead gives a smooth, reliable loop with no per-frame re-renders.
//
// Two identical groups sit side by side, so translating by exactly one group's
// width lines the second group up precisely where the first began — the loop
// restarts from 0 without any visible jump.
const DishTicker = () => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (!trackWidth) return undefined;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -trackWidth,
        duration: Math.round((trackWidth / TICKER_SPEED) * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [trackWidth, translateX]);

  const renderGroup = (keyPrefix) =>
    TICKER_DISHES.map((dish, i) => (
      <View key={`${keyPrefix}-${dish}-${i}`} style={styles.tickItem}>
        <Text style={styles.tickText}>{dish} •</Text>
      </View>
    ));

  return (
    <View style={styles.ticker} pointerEvents="none">
      <Animated.View style={[styles.tickerTrack, { transform: [{ translateX }] }]}>
        <View
          style={styles.tickerGroup}
          onLayout={(e) => setTrackWidth(Math.round(e.nativeEvent.layout.width))}>
          {renderGroup('a')}
        </View>
        <View style={styles.tickerGroup}>{renderGroup('b')}</View>
      </Animated.View>
    </View>
  );
};

const PendingCookRatings = () => {
  const user = useSelector((s) => s.auth.user);
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [dismissed, setDismissed] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (!user || user.role !== 'customer') return;
      let alive = true;
      API.get('/bookings/my')
        .then((res) => {
          if (alive) setBookings(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [user]),
  );

  if (!user || user.role !== 'customer') return null;
  const rateable = (bookings || []).filter(
    (b) => !b.review && !dismissed.includes(b._id) && isReviewable(b),
  );
  if (!rateable.length) return null;

  return (
    <View style={styles.rateSection}>
      <View style={styles.rateHead}>
        <View>
          <Text style={styles.rateEyebrow}>★ Your feedback matters</Text>
          <Text style={styles.rateTitle}>
            Rate your cook <Text style={styles.rateCount}>{rateable.length}</Text>
          </Text>
          <Text style={styles.rateSub}>
            Your service hours are complete — tap the stars to rate. A written review is optional.
          </Text>
        </View>
        <TouchableOpacity onPress={() => setDismissed([...dismissed, ...rateable.map((b) => b._id)])}>
          <Text style={styles.dismiss}>Dismiss all</Text>
        </TouchableOpacity>
      </View>
      {rateable.map((b) => (
        <View key={b._id} style={styles.rateCard}>
          <View style={styles.rateCardHead}>
            <View style={styles.rateAvatar}>
              <Text style={styles.rateAvatarText}>
                {String(b.cook?.name?.[0] || 'C').toUpperCase()}
              </Text>
            </View>
            <View style={shared.flex1}>
              <Text style={shared.h3}>How was {b.cook?.name || 'your cook'}?</Text>
              <Text style={shared.small}>
                {[b.serviceType?.replace(/_/g, ' '), b.date ? formatDate(b.date) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setDismissed([...dismissed, b._id])}>
              <Text style={styles.dismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Button
            title="Rate now"
            onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}
          />
        </View>
      ))}
    </View>
  );
};

const HeroStats = () => {
  const [stats, setStats] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      API.get('/stats/public')
        .then((res) => {
          if (alive) setStats(res.data || null);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  const showBookings = (stats?.bookings ?? 0) >= 20;
  const showRating = (stats?.ratingCount ?? 0) >= 5 && stats?.ratingAverage != null;
  if (!showBookings && !showRating) return null;
  return (
    <View style={styles.heroStats}>
      {showBookings ? (
        <View style={styles.heroStat}>
          <Text style={styles.heroStatNum}>{stats.bookings}+</Text>
          <Text style={styles.heroStatLabel}>Sessions Completed</Text>
        </View>
      ) : null}
      {showRating ? (
        <View style={styles.heroStat}>
          <Text style={styles.heroStatNum}>{Number(stats.ratingAverage).toFixed(1)} ★</Text>
          <Text style={styles.heroStatLabel}>Average Rating</Text>
        </View>
      ) : null}
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const user = useSelector((s) => s.auth.user);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(null);
  // Detect the customer's area as soon as the app opens so the venue pin is
  // ready by the time they reach the booking screen. Cooks do not use the
  // venue pin, so they are not prompted.
  const location = useDeviceLocation({ auto: user?.role === 'customer' });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await API.get('/coupons/active').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.coupons || [];
      setCoupons(list.filter((c) => c && c.code));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load home content.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sign-in can interrupt a booking. Resume the Book tab once, then clear the
  // marker so later visits to Home behave normally.
  useEffect(() => {
    if (!user || user.role !== 'customer') return undefined;
    let alive = true;
    consumePostAuthTarget().then((target) => {
      if (alive && target === 'Book') navigation.navigate('Book', { cookId: null, couponCode: null });
    });
    return () => {
      alive = false;
    };
  }, [user, navigation]);

  // Split the discount into a large value and a small unit so the ticket stub can
  // set them at different sizes ("30%" over "OFF").
  const couponBadge = (c) =>
    c.discountType === 'flat' && c.flatAmount != null
      ? { value: `₹${c.flatAmount}`, label: 'OFF' }
      : { value: `${c.percent}%`, label: 'OFF' };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[colors.primary]}
          />
        }>
        <LocationNotice
          status={location.status}
          loading={location.loading}
          onRetry={location.detect}
        />
        <DishCarousel />
        <PendingCookRatings />

        {/* Hero — mirrors website .hero-v2 */}
        <View style={styles.hero}>
          {/* Warm gradient wash plus a soft radial bloom behind the headline. */}
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id="hero-wash" x1="0" y1="0" x2="0.35" y2="1">
                <Stop offset="0" stopColor="#fffdf8" />
                <Stop offset="0.55" stopColor="#fff8ec" />
                <Stop offset="1" stopColor="#ffefdb" />
              </LinearGradient>
              <RadialGradient id="hero-bloom" cx="0.12" cy="0.06" r="0.85">
                <Stop offset="0" stopColor="#fb923c" stopOpacity={0.18} />
                <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={1} height={1} fill="url(#hero-wash)" />
            <Rect x={0} y={0} width={1} height={1} fill="url(#hero-bloom)" />
          </Svg>

          <View style={styles.heroPill}>
            <Sparkles size={12} color="#ea580c" />
            <Text style={styles.heroPillText}>Navratri Special</Text>
          </View>

          <Text style={styles.heroTitle}>
            Festive Feasts, <Text style={styles.heroAccent}>Cooked Fresh</Text> in Your Kitchen
          </Text>
          <Text style={styles.heroSub}>
            Celebrate Navratri with vrat-friendly feasts — sabudana khichdi, kuttu parathas, samak rice
            &amp; more — cooked fresh in your kitchen by verified home cooks. OTP-verified starts, secure
            UPI payments, and real-time alerts.
          </Text>

          <View style={styles.heroActions}>
            {user?.role === 'cook' ? (
              <Button title="Go to Cook Dashboard →" onPress={() => navigation.navigate('Cook', { screen: 'Jobs' })} />
            ) : (
              <Button title="Book a Cook →" onPress={() => navigation.navigate('Book', { cookId: null, couponCode: null })} />
            )}
          </View>

          <View style={styles.perks}>
            {HERO_PERKS.map((p) => {
              const Icon = p.icon;
              return (
                <View key={p.label} style={styles.perk}>
                  <View style={styles.perkIcon}>
                    <Icon size={12} color={colors.primary700} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.perkText}>{p.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Media on a gradient frame, with a trust badge floating over it. */}
          <View style={styles.heroMedia}>
            <View style={styles.heroImgWrap}>
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
                <Defs>
                  <LinearGradient id="hero-media-frame" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#fdba74" />
                    <Stop offset="1" stopColor="#ea580c" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={1} height={1} fill="url(#hero-media-frame)" />
              </Svg>
              <Image source={require('../../../assets/hero.png')} style={styles.heroImg} resizeMode="cover" />
            </View>
            <View style={styles.heroMediaBadge}>
              <ShieldCheck size={12} color="#fff" />
              <Text style={styles.heroMediaBadgeText}>OTP-Verified Start</Text>
            </View>
          </View>

          <View style={styles.proof}>
            <View style={styles.avatars}>
              <View style={[styles.avatarSm, styles.avatarA]}>
                <Text style={styles.avatarSmText}>AD</Text>
              </View>
              <View style={[styles.avatarSm, styles.avatarB]}>
                <Text style={styles.avatarSmText}>VK</Text>
              </View>
              <View style={[styles.avatarSm, styles.avatarC]}>
                <Text style={styles.avatarSmText}>RS</Text>
              </View>
              <View style={styles.avatarsMore}>
                <Text style={styles.avatarsMoreText}>+2k</Text>
              </View>
            </View>
            <View style={styles.proofMeta}>
              <View style={styles.ratingRow}>
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <Text style={styles.ratingNum}>4.9</Text>
              </View>
              <Text style={styles.proofText}>
                Loved by <Text style={styles.proofStrong}>2,400+ families</Text>
              </Text>
            </View>
          </View>
          <HeroStats />
        </View>

        {/* Dish ticker */}
        <DishTicker />

        {/* Coupons — mirrors website HomeCoupons */}
        {loading ? (
          <View style={styles.sectionPad}>
            <Loader message="Loading offers…" />
          </View>
        ) : coupons.length ? (
          <View style={styles.couponSection}>
            <View style={styles.couponPill}>
              <Sparkles size={12} color="#ffd24d" />
              <Text style={styles.couponPillText}>
                {`${coupons.length} Live ${coupons.length === 1 ? 'Offer' : 'Offers'}`}
              </Text>
            </View>
            <Text style={styles.couponTitle}>Festive Offers For You</Text>
            <Text style={styles.couponSub}>
              Apply a coupon while booking — one offer per session, straight off your bill.
            </Text>
            {coupons.map((c, i) => {
              const badge = couponBadge(c);
              const isBest = i === 0;
              return (
                <View key={c.code} style={[styles.couponCard, isBest && styles.couponCardBest]}>
                  {/* Warm corner bloom, clipped to the card so it never spills. */}
                  <View style={styles.couponGlow} pointerEvents="none">
                    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
                      <Defs>
                        <RadialGradient id={`coupon-glow-${i}`} cx="0.82" cy="0.12" r="0.95">
                          <Stop offset="0" stopColor="#ffb020" stopOpacity={0.22} />
                          <Stop offset="1" stopColor="#ffb020" stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Rect x={0} y={0} width={1} height={1} fill={`url(#coupon-glow-${i})`} />
                    </Svg>
                  </View>

                  {isBest ? (
                    <View style={styles.couponBest}>
                      <Sparkles size={11} color="#2b1405" />
                      <Text style={styles.couponBestText}>Best Offer</Text>
                    </View>
                  ) : null}

                  {/* Gradient discount stub — the visual anchor of the ticket. */}
                  <View style={styles.couponStub}>
                    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
                      <Defs>
                        <LinearGradient id={`coupon-stub-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#ffd479" />
                          <Stop offset="0.5" stopColor="#fcaa2e" />
                          <Stop offset="1" stopColor="#f76707" />
                        </LinearGradient>
                      </Defs>
                      <Rect x={0} y={0} width={1} height={1} fill={`url(#coupon-stub-${i})`} />
                    </Svg>
                    <View style={styles.couponStubGloss} pointerEvents="none" />
                    <View style={styles.couponStubIcon}>
                      <BadgePercent size={15} color="#3b1a05" />
                    </View>
                    <Text style={styles.couponStubValue}>{badge.value}</Text>
                    <Text style={styles.couponStubLabel}>{badge.label}</Text>
                  </View>

                  {/* Perforation: evenly spaced dashes plus die-cut notches that
                      bite out of the card edge at the top and bottom. */}
                  <View style={styles.couponPerf}>
                    {Array.from({ length: 10 }).map((_, d) => (
                      <View key={d} style={styles.couponDash} />
                    ))}
                    <View style={[styles.couponNotch, styles.couponNotchTop]} />
                    <View style={[styles.couponNotch, styles.couponNotchBottom]} />
                  </View>

                  <View style={styles.couponBody}>
                    <View style={styles.couponCodeRow}>
                      <Text style={styles.couponCode} numberOfLines={1}>
                        {c.code}
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Apply coupon ${c.code}`}
                        onPress={() => {
                          setCopied(c.code);
                          navigation.navigate('Book', { couponCode: c.code });
                        }}
                        style={styles.couponApply}>
                        <Text style={styles.couponApplyText}>
                          {copied === c.code ? '✓ Applied' : 'Apply'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {c.description ? <Text style={styles.couponDesc}>{c.description}</Text> : null}
                    <View style={styles.metaRow}>
                      {c.minOrder ? (
                        <MetaChip icon={ShoppingBag} label={`Min order ₹${c.minOrder}`} />
                      ) : null}
                      {c.discountType !== 'flat' && c.maxDiscount ? (
                        <MetaChip icon={BadgePercent} label={`Up to ₹${c.maxDiscount} off`} />
                      ) : null}
                      {c.validTo ? (
                        <MetaChip
                          icon={Clock}
                          label={`Valid till ${new Date(c.validTo).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}`}
                        />
                      ) : null}
                      {c.firstBookingOnly ? (
                        <MetaChip icon={Sparkles} label="First booking only" />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
            <Button title="Book a Festive Cook →" onPress={() => navigation.navigate('Book', { cookId: null, couponCode: null })} />
          </View>
        ) : null}

        <ErrorBanner message={error} onRetry={load} />

        {/* Join — mirrors website lead-section (guests only) */}
        {!user ? (
          <View style={styles.lead}>
            <Text style={styles.eyebrow}>Join Cook Mitra</Text>
            <Text style={styles.sectionTitleLeft}>Create Your Account</Text>
            <Text style={styles.sectionDescLeft}>
              Sign up to book verified festive cooks, manage your reservations, and bring authentic
              festival flavors to your home.
            </Text>
            {[
              'Book verified cooks in your area',
              'Manage bookings and track live',
              'Rate and review your experience',
            ].map((b) => (
              <View key={b} style={styles.benefit}>
                <CheckCircle2 size={16} color={colors.emerald} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
            <Button title="Create an account" onPress={() => navigation.navigate('Auth', { screen: 'Register' })} />
          </View>
        ) : null}

        {/* How it works — mirrors website .home-band.band-slate */}
        <View style={styles.howBand}>
          {/* Full-bleed warm gradient wash. viewBox 0 0 1 1 + preserveAspectRatio
              "none" scales the unit rect to whatever height the content needs. */}
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id="how-band-gradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#fffaf6" />
                <Stop offset="1" stopColor="#fdeadd" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={1} height={1} fill="url(#how-band-gradient)" />
          </Svg>
          <View style={styles.howPill}>
            <Sparkles size={13} color={colors.primary700} />
            <Text style={styles.howPillText}>Simple &amp; Transparent</Text>
          </View>
          <Text style={styles.howHeading}>How Cook Mitra Works</Text>
          <Text style={styles.howSub}>
            Bring the joy of authentic festive cooking to your home in four simple steps.
          </Text>
          <View style={styles.howSteps}>
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              const last = i === HOW_STEPS.length - 1;
              return (
                <View key={s.step} style={styles.howRow}>
                  <View style={styles.howRail}>
                    <StepNode step={s.step} Icon={Icon} />
                    {last ? null : (
                      <View style={[styles.howLine, { backgroundColor: HOW_RAIL_TINTS[i] }]} />
                    )}
                  </View>
                  <View style={[styles.howCard, last && styles.howCardLast]}>
                    <Text style={styles.howCardGhost}>{s.step}</Text>
                    <Text style={styles.howStepLabel}>Step {s.step}</Text>
                    <Text style={styles.howCardTitle}>{s.title}</Text>
                    <Text style={styles.howCardText}>{s.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Testimonials — mirrors website .band-abyss */}
        <View style={styles.testiBand}>
          <Text style={[styles.eyebrowCenter, styles.eyebrowDark]}>Customer Stories</Text>
          <Text style={[styles.sectionTitle, styles.darkTitle]}>Loved by Festival Hosts</Text>
          <Text style={[styles.sectionDesc, styles.darkSub]}>
            Read how Cook Mitra brought authentic celebrations into modern homes.
          </Text>
          {TESTIMONIALS.map((t) => (
            <View key={t.name} style={styles.testiCard}>
              <View style={styles.testiStars}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={18} fill="#f59e0b" color="#f59e0b" />
                ))}
              </View>
              <Text style={styles.testiQuote}>"{t.quote}"</Text>
              <View style={styles.testiAuthor}>
                <View style={styles.testiAvatar}>
                  <Text style={styles.testiAvatarText}>{t.avatar}</Text>
                </View>
                <View>
                  <Text style={styles.testiName}>{t.name}</Text>
                  <Text style={styles.testiRole}>{t.role}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Cook CTA — mirrors website .cta-cook */}
        {user?.role !== 'cook' && user?.role !== 'admin' ? (
          <View style={styles.cookCta}>
            <View style={styles.cookBadge}>
              <ChefHat size={14} color={colors.white} />
              <Text style={styles.cookBadgeText}>For Home Chefs · Earn Festive Income</Text>
            </View>
            <Text style={styles.cookTitle}>Are You a Skilled Home Cook?</Text>
            <Text style={styles.cookSub}>
              Turn your family recipes into festive earnings. Share your traditional culinary recipes
              and cooking skills with families in your city — on flexible slots, with a verified profile.
            </Text>
            {[
              { icon: ChefHat, t: 'Share recipes', s: 'Traditional festive dishes' },
              { icon: CalendarClock, t: 'Flexible slots', s: 'You choose timings' },
              { icon: ShieldCheck, t: 'Verified profile', s: 'Build trust & reviews' },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <View key={p.t} style={styles.cookPerk}>
                  <View style={styles.cookPerkIcon}>
                    <Icon size={17} color={colors.primary700} />
                  </View>
                  <View>
                    <Text style={styles.cookPerkTitle}>{p.t}</Text>
                    <Text style={styles.cookPerkSub}>{p.s}</Text>
                  </View>
                </View>
              );
            })}
            <Button
              title={user ? 'Join as a Cook →' : 'Register as a Cook →'}
              variant="light"
              onPress={() => navigation.navigate('Auth', { screen: 'Register', params: { role: 'cook' } })}
            />
            {!user ? (
              <View style={styles.cookAltAction}>
                <Button
                  title="Already a cook? Sign in"
                  variant="ghost"
                  onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                />
              </View>
            ) : null}
            <Text style={styles.cookNote}>No joining fee · Festive demand in Pune</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  carousel: { paddingHorizontal: 16, paddingTop: 8 },
  slide: { width: SCREEN_W - 32, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card },
  slideImg: { width: '100%', height: 100, borderRadius: 20 },
  rateSection: { padding: 16, backgroundColor: '#fff7ed', marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.primary100 },
  rateHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  rateEyebrow: { fontSize: 12, fontWeight: '800', color: colors.primary700 },
  rateTitle: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  rateCount: { color: colors.primary },
  rateSub: { fontSize: 13, color: colors.slate600, marginTop: 4, maxWidth: 260 },
  dismiss: { fontSize: 13, fontWeight: '700', color: colors.slate500 },
  rateCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  rateCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rateAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rateAvatarText: { color: colors.white, fontWeight: '800', fontSize: 18 },
  hero: { backgroundColor: '#fffdf8', padding: 16, paddingTop: 18, borderBottomWidth: 1, borderBottomColor: '#FFEDD5' },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(253,233,200,1)',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 5,
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  heroPillText: { fontSize: 11, fontWeight: '800', color: '#9a3412', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroTitle: { fontSize: 31, fontWeight: '800', color: '#3f1d0b', lineHeight: 37, letterSpacing: -0.8, marginTop: 14 },
  heroAccent: { color: '#ea580c' },
  heroSub: { fontSize: 15, color: '#7C2D12', lineHeight: 23, marginTop: 12 },
  heroActions: { marginTop: 16 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(253,233,200,1)',
    borderRadius: 99,
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 5,
  },
  perkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { fontSize: 12, fontWeight: '700', color: '#7C2D12' },
  // The shadow lives here rather than on heroImgWrap: Android clips a shadow
  // when the same view also has overflow hidden (needed to round the frame).
  heroMedia: {
    marginTop: 16,
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  heroImgWrap: { borderRadius: 22, padding: 5, overflow: 'hidden', backgroundColor: '#f97316' },
  heroImg: { width: '100%', height: 224, borderRadius: 17 },
  heroMediaBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(28,14,5,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMediaBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  proof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(253,233,200,0.95)',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarSm: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarA: { backgroundColor: '#f97316' },
  avatarB: { backgroundColor: '#8b5cf6', marginLeft: -10 },
  avatarC: { backgroundColor: '#059669', marginLeft: -10 },
  avatarSmText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  avatarsMore: { marginLeft: -10, backgroundColor: '#FEF3C7', borderRadius: 99, paddingHorizontal: 8, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarsMoreText: { fontSize: 11, fontWeight: '800', color: '#7C2D12' },
  proofMeta: { flex: 1, flexShrink: 1, gap: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingNum: { fontWeight: '800', color: '#C2410C', marginLeft: 4, fontSize: 13 },
  proofText: { fontSize: 13, color: '#7C2D12' },
  proofStrong: { color: '#C2410C', fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(253,233,200,0.95)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  heroStatNum: { fontSize: 22, fontWeight: '800', color: '#C2410C' },
  heroStatLabel: { fontSize: 12, color: '#7C2D12', marginTop: 2 },
  ticker: { backgroundColor: colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 10, overflow: 'hidden' },
  tickerTrack: { flexDirection: 'row' },
  tickerGroup: { flexDirection: 'row' },
  tickItem: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary100, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 4 },
  tickText: { color: colors.primary700, fontWeight: '700', fontSize: 13 },
  sectionPad: { padding: 16 },
  couponSection: { backgroundColor: COUPON_BAND_BG, padding: 16 },
  couponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,210,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,210,77,0.28)',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  couponPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffd24d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  couponTitle: { fontSize: 23, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.3, marginTop: 12 },
  couponSub: { fontSize: 14, color: 'rgba(255,244,230,0.78)', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  // Ticket card: no overflow clipping, because the die-cut notches have to be
  // able to paint outside the card bounds.
  couponCard: {
    flexDirection: 'row',
    backgroundColor: '#1c1219',
    borderWidth: 1,
    borderColor: 'rgba(255,210,77,0.22)',
    borderRadius: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  // The lead offer gets a warmer border and an orange-tinted glow.
  couponCardBest: { borderColor: 'rgba(255,210,77,0.5)', shadowColor: '#f76707', shadowOpacity: 0.3 },
  couponGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, overflow: 'hidden' },
  couponBest: {
    position: 'absolute',
    top: -9,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffd24d',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  couponBestText: {
    color: '#2b1405',
    fontSize: 9.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  couponStub: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderTopLeftRadius: 17,
    borderBottomLeftRadius: 17,
    overflow: 'hidden',
  },
  // Rotated translucent bar clipped by the stub — reads as a light sweep across
  // the gradient. Sits under the text so the numbers stay crisp.
  couponStubGloss: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 60,
    height: 240,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ rotate: '22deg' }],
  },
  couponStubIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(43,20,5,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  couponStubValue: { fontSize: 27, fontWeight: '900', color: '#2b1405', letterSpacing: -1 },
  couponStubLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(43,20,5,0.78)',
    letterSpacing: 1.6,
    marginTop: 1,
  },
  couponPerf: { width: 20, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  couponDash: { width: 2, height: 6, borderRadius: 1, backgroundColor: 'rgba(255,210,77,0.3)' },
  couponNotch: {
    position: 'absolute',
    left: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COUPON_BAND_BG,
  },
  couponNotchTop: { top: -9 },
  couponNotchBottom: { bottom: -9 },
  couponBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, justifyContent: 'center' },
  couponCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(255,210,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,210,77,0.28)',
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  couponCode: {
    flexShrink: 1,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  couponApply: { backgroundColor: '#ffd24d', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  couponApplyText: { color: '#2b1405', fontWeight: '800', fontSize: 12.5, letterSpacing: 0.3 },
  couponDesc: { color: '#fff4e6', opacity: 0.82, fontSize: 14, marginTop: 10, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,210,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,210,77,0.25)',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  metaText: { fontSize: 11.5, fontWeight: '600', color: '#ffe08a' },
  lead: { padding: 16, backgroundColor: colors.card },
  eyebrow: { fontSize: 12, fontWeight: '800', color: colors.primary700, textTransform: 'uppercase', letterSpacing: 0.5 },
  eyebrowCenter: { fontSize: 12, fontWeight: '800', color: colors.primary700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  eyebrowDark: { color: '#ffd24d' },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: colors.slate900, textAlign: 'center', marginTop: 6 },
  sectionTitleLeft: { fontSize: 24, fontWeight: '800', color: colors.slate900, marginTop: 6 },
  sectionDesc: { fontSize: 15, color: colors.slate600, textAlign: 'center', marginTop: 6, marginBottom: 14, lineHeight: 22 },
  sectionDescLeft: { fontSize: 15, color: colors.slate600, marginTop: 6, marginBottom: 12, lineHeight: 22 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  benefitText: { fontSize: 14, fontWeight: '600', color: colors.slate700 },
  howBand: {
    backgroundColor: '#fffaf6',
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  howPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary100,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  howPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  howHeading: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.slate900,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: -0.5,
  },
  howSub: {
    fontSize: 15,
    color: colors.slate600,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  howSteps: { marginTop: 26 },
  howRow: { flexDirection: 'row', alignItems: 'stretch' },
  howRail: { width: 46, alignItems: 'center' },
  howNode: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9a3412',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  howLine: { flex: 1, width: 2, borderRadius: 1, marginTop: 4 },
  howCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f6ece2',
    borderRadius: 22,
    padding: 16,
    marginLeft: 10,
    marginBottom: 14,
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  howCardLast: { marginBottom: 0 },
  // Oversized faint numeral anchored to the card corner — adds depth without
  // competing with the step label or title for attention.
  howCardGhost: {
    position: 'absolute',
    top: 2,
    right: 12,
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(234,88,12,0.11)',
    letterSpacing: -1.5,
  },
  howStepLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  howCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: 4,
    paddingRight: 34,
  },
  howCardText: { color: colors.slate600, fontSize: 14, lineHeight: 20 },
  testiBand: { backgroundColor: '#120b18', padding: 16 },
  darkTitle: { color: '#fff' },
  darkSub: { color: 'rgba(255,255,255,0.7)' },
  testiCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 16, marginBottom: 12 },
  testiStars: { flexDirection: 'row', gap: 3, marginBottom: 8 },
  testiQuote: { color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 22 },
  testiAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  testiAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  testiAvatarText: { color: '#fff', fontWeight: '800' },
  testiName: { color: '#fff', fontWeight: '700' },
  testiRole: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  cookCta: { backgroundColor: '#c2410c', padding: 18, marginHorizontal: 16, marginVertical: 16, borderRadius: 28 },
  cookBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 10 },
  cookBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  cookTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  cookSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 12 },
  cookPerk: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 10, marginBottom: 8 },
  cookPerkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cookPerkTitle: { color: '#fff', fontWeight: '800' },
  cookPerkSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  cookAltAction: { marginTop: 10 },
  cookNote: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginTop: 8 },
});

export default HomeScreen;
