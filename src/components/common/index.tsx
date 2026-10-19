/**
 * Dabba Nation UI kit (Customer app). All screens build on these primitives and src/theme tokens.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  ViewStyle,
  TextStyle,
  StyleProp,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, fonts, formatPrice, orderStatusColors, radius, sizes, spacing, type } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Loading ──────────────────────────────────────────────────────────

interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  style?: StyleProp<ViewStyle>;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'large', color = colors.primary, text, style }) => (
  <View style={[styles.loadingContainer, style]}>
    <ActivityIndicator size={size} color={color} />
    {text ? <Text style={styles.loadingText}>{text}</Text> : null}
  </View>
);

/** Pulsing placeholder block for skeleton layouts */
export const Skeleton: React.FC<{ width?: ViewStyle['width']; height?: number; radius?: number; style?: StyleProp<ViewStyle> }> = ({
  width = '100%',
  height = 14,
  radius: r = radius.sm,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceMuted, opacity }, style]} />;
};

/** Generic list skeleton: image block + two text lines */
export const SkeletonList: React.FC<{ count?: number; imageSize?: number }> = ({ count = 3, imageSize = 64 }) => (
  <View style={{ gap: spacing.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={[styles.card, styles.cardPadded, { flexDirection: 'row', gap: spacing.md }]}>
        <Skeleton width={imageSize} height={imageSize} radius={radius.md} />
        <View style={{ flex: 1, gap: spacing.sm, justifyContent: 'center' }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={12} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
    ))}
  </View>
);

// ─── Buttons ──────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success' | 'outline';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const buttonTone = (variant: ButtonVariant) => {
  switch (variant) {
    case 'secondary':
      return { bg: colors.surface, fg: colors.text, border: colors.border };
    case 'outline':
      return { bg: colors.surface, fg: colors.primaryInk, border: colors.primaryBorder };
    case 'tertiary':
      return { bg: 'transparent', fg: colors.primaryInk, border: 'transparent' };
    case 'destructive':
      return { bg: colors.danger, fg: colors.textInverse, border: colors.danger };
    case 'success':
      return { bg: colors.success, fg: colors.textInverse, border: colors.success };
    default:
      return { bg: colors.primary, fg: colors.textInverse, border: colors.primary };
  }
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const tone = buttonTone(variant);
  const inactive = disabled || loading;
  const isFilled = variant === 'primary' || variant === 'destructive' || variant === 'success';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: tone.bg, borderColor: tone.border },
        variant === 'tertiary' && styles.buttonTertiary,
        fullWidth && { alignSelf: 'stretch' },
        pressed && !inactive && (isFilled ? { backgroundColor: variant === 'primary' ? colors.primaryPressed : tone.bg, opacity: variant === 'primary' ? 1 : 0.9 } : { backgroundColor: colors.surfaceMuted }),
        disabled && (variant === 'primary' ? { backgroundColor: colors.primaryDisabled, borderColor: colors.primaryDisabled } : { opacity: 0.45 }),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={tone.fg} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSm, { color: tone.fg }, textStyle]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={size === 'sm' ? 16 : 18} color={tone.fg} /> : null}
        </>
      )}
    </Pressable>
  );
};

export const IconButton: React.FC<{
  icon: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  badge?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  variant?: 'plain' | 'filled';
}> = ({ icon, onPress, color = colors.text, size = sizes.iconLg, badge, style, accessibilityLabel, variant = 'plain' }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    style={[styles.iconButton, variant === 'filled' && styles.iconButtonFilled, style]}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={size} color={color} />
    {badge ? (
      <View style={styles.iconBadge}>
        <Text style={styles.iconBadgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

// ─── Inputs ───────────────────────────────────────────────────────────

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  icon?: IconName;
  error?: string;
  helper?: string;
  required?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, icon, error, helper, required, right, style, inputStyle, secureTextEntry, multiline, editable = true, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={[styles.inputContainer, style]}>
      {label ? (
        <Text style={styles.inputLabel}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
      >
        {icon ? <Ionicons name={icon} size={sizes.icon} color={focused ? colors.text : colors.textTertiary} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={hidden}
          multiline={multiline}
          editable={editable}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={sizes.icon} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
        {right}
      </View>
      {error ? (
        <View style={styles.inputMessageRow}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

// ─── Surfaces ─────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  variant?: 'elevated' | 'outlined' | 'flat';
  selected?: boolean;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, padded = true, variant = 'elevated', selected, accessibilityLabel }) => {
  const cardStyle = [
    styles.card,
    padded && styles.cardPadded,
    variant === 'elevated' && styles.cardOutlined, // flat paper cards: hairline instead of a drop shadow
    variant === 'outlined' && styles.cardOutlined,
    variant === 'flat' && styles.cardFlat,
    selected && styles.cardSelected,
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

export const Divider: React.FC<{ style?: StyleProp<ViewStyle>; inset?: number }> = ({ style, inset = 0 }) => (
  <View style={[styles.divider, inset ? { marginLeft: inset } : null, style]} />
);

// ─── Badges & chips ───────────────────────────────────────────────────

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'error';

const toneColors = (tone: Tone) => {
  switch (tone) {
    case 'primary': return { bg: colors.primarySoft, fg: colors.primaryInk };
    case 'success': return { bg: colors.successSoft, fg: colors.successStrong };
    case 'warning': return { bg: colors.warningSoft, fg: colors.warningStrong };
    case 'danger':
    case 'error': return { bg: colors.dangerSoft, fg: colors.danger };
    case 'info': return { bg: colors.infoSoft, fg: colors.info };
    default: return { bg: colors.surfaceMuted, fg: colors.textSecondary };
  }
};

interface BadgeProps {
  text: string;
  variant?: Tone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'neutral', icon, style }) => {
  const tone = toneColors(variant);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={tone.fg} /> : null}
      <Text style={[styles.badgeText, { color: tone.fg }]} numberOfLines={1}>{text}</Text>
    </View>
  );
};

export const StatusBadge: React.FC<{ status: string; label?: string; style?: StyleProp<ViewStyle> }> = ({ status, label, style }) => {
  const c = orderStatusColors[status] || { bg: colors.surfaceMuted, fg: colors.textSecondary, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.badgeText, { color: c.fg }]} numberOfLines={1}>{label || c.label}</Text>
    </View>
  );
};

export const Chip: React.FC<{
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  count?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ label, selected, onPress, icon, count, style }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    style={[styles.chip, selected && styles.chipSelected, style]}
  >
    {icon ? <Ionicons name={icon} size={14} color={selected ? colors.textInverse : colors.text} /> : null}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text>
    {count !== undefined ? (
      <View style={[styles.chipCount, selected && styles.chipCountSelected]}>
        <Text style={[styles.chipCountText, selected && { color: colors.text }]}>{count}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

export const ChipRow: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, style]}>
    {children}
  </ScrollView>
);

export const SegmentedControl = <K extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.segmented, style]} accessibilityRole="tablist">
    {options.map((o) => {
      const active = o.key === value;
      return (
        <TouchableOpacity
          key={o.key}
          onPress={() => onChange(o.key)}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          style={[styles.segment, active && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{o.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Headers & rows ───────────────────────────────────────────────────

export const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ title, subtitle, onBack, showBack = true, right, style }) => {
  const navigation = useNavigation<any>();
  return (
    <View style={[styles.screenHeader, style]}>
      {showBack ? (
        <IconButton
          icon="arrow-back"
          accessibilityLabel="Go back"
          onPress={onBack || (() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')))}
          style={{ marginLeft: -spacing.sm }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.heading} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={type.caption} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ title, subtitle, actionLabel, onAction, style }) => (
  <View style={[styles.sectionHeader, style]}>
    <View style={{ flex: 1 }}>
      <Text style={type.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={[type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button">
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const ListRow: React.FC<{
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, iconColor, title, subtitle, value, right, onPress, destructive, showChevron = !!onPress, style }) => {
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, destructive && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={sizes.icon} color={destructive ? colors.danger : iconColor || colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, destructive && { color: colors.danger }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[type.small, { color: colors.textSecondary }]}>{value}</Text> : null}
      {right}
      {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} /> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={[styles.listRow, style]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  ) : (
    <View style={[styles.listRow, style]}>{content}</View>
  );
};

// ─── Feedback states ──────────────────────────────────────────────────

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, actionText, onAction, style }) => (
  <View style={[styles.emptyState, style]}>
    <View style={styles.emptyIcon}>
      <Ionicons name={icon} size={32} color={colors.text} />
    </View>
    <Text style={[type.heading, styles.centerText]}>{title}</Text>
    {subtitle ? <Text style={[type.small, styles.centerText, { color: colors.textSecondary, marginTop: spacing.xs }]}>{subtitle}</Text> : null}
    {actionText && onAction ? <Button title={actionText} onPress={onAction} style={{ marginTop: spacing.lg, minWidth: 180 }} /> : null}
  </View>
);

export const ErrorState: React.FC<{ title?: string; message?: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }> = ({
  title = 'Something went wrong',
  message = 'Please check your connection and try again.',
  onRetry,
  style,
}) => (
  <View style={[styles.emptyState, style]}>
    <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
      <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
    </View>
    <Text style={[type.heading, styles.centerText]}>{title}</Text>
    <Text style={[type.small, styles.centerText, { color: colors.textSecondary, marginTop: spacing.xs }]}>{message}</Text>
    {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} style={{ marginTop: spacing.lg, minWidth: 160 }} /> : null}
  </View>
);

/** Inline notice for warnings, errors and info inside a screen */
export const Notice: React.FC<{
  tone?: Tone;
  icon?: IconName;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ tone = 'info', icon, title, message, actionLabel, onAction, style }) => {
  const c = toneColors(tone);
  const defaultIcon: IconName = tone === 'danger' || tone === 'error' ? 'alert-circle' : tone === 'warning' ? 'warning' : tone === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }, style]}>
      <Ionicons name={icon || defaultIcon} size={18} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[type.label, { color: c.fg }]}>{title}</Text> : null}
        <Text style={[type.small, { color: title ? colors.text : c.fg }]}>{message}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[type.label, { color: c.fg }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── Commerce ─────────────────────────────────────────────────────────

interface RatingProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}

export const Rating: React.FC<RatingProps> = ({ rating, size = 14, showValue = true, count }) => (
  <View style={styles.ratingContainer}>
    <Ionicons name="star" size={size} color={colors.rating} />
    {showValue ? <Text style={styles.ratingText}>{Number(rating || 0).toFixed(1)}</Text> : null}
    {count ? <Text style={[type.caption, { marginLeft: 2 }]}>({count})</Text> : null}
  </View>
);

interface PriceProps {
  amount: number;
  originalAmount?: number;
  size?: 'small' | 'medium' | 'large';
}

export const Price: React.FC<PriceProps> = ({ amount, originalAmount, size = 'medium' }) => {
  const fontSize = size === 'small' ? 13 : size === 'large' ? 20 : 15;
  return (
    <View style={styles.priceContainer}>
      <Text style={[type.price, { fontSize, lineHeight: fontSize + 6 }]}>{formatPrice(amount)}</Text>
      {originalAmount && originalAmount > amount ? (
        <Text style={[styles.originalPrice, { fontSize: fontSize - 2 }]}>{formatPrice(originalAmount)}</Text>
      ) : null}
    </View>
  );
};

/** Bill line: label on the left, amount on the right */
export const PriceRow: React.FC<{
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  tone?: 'default' | 'success' | 'danger' | 'muted';
  style?: StyleProp<ViewStyle>;
}> = ({ label, value, hint, emphasis, tone = 'default', style }) => {
  const color = tone === 'success' ? colors.successStrong : tone === 'danger' ? colors.danger : tone === 'muted' ? colors.textSecondary : colors.text;
  return (
    <View style={[styles.priceRow, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[emphasis ? type.bodyStrong : type.small, { color: emphasis ? colors.text : colors.textSecondary }]}>{label}</Text>
        {hint ? <Text style={type.caption}>{hint}</Text> : null}
      </View>
      <Text style={[emphasis ? type.price : type.small, { color, fontVariant: ['tabular-nums'] }, emphasis && { fontSize: 17 }]}>{value}</Text>
    </View>
  );
};

export const VegIndicator: React.FC<{ isVeg?: boolean; size?: number }> = ({ isVeg = true, size = 14 }) => (
  <View
    accessibilityLabel={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    style={[styles.vegBox, { width: size, height: size, borderColor: isVeg ? colors.veg : colors.nonVeg }]}
  >
    <View style={{ width: size / 2, height: size / 2, borderRadius: size, backgroundColor: isVeg ? colors.veg : colors.nonVeg }} />
  </View>
);

export const QuantityStepper: React.FC<{
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  size?: 'md' | 'sm';
}> = ({ quantity, onIncrement, onDecrement, disabled, size = 'md' }) => (
  <View style={[styles.stepper, size === 'sm' && styles.stepperSm, disabled && { opacity: 0.5 }]}>
    <TouchableOpacity onPress={onDecrement} disabled={disabled} style={styles.stepperBtn} accessibilityLabel="Decrease quantity" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Ionicons name={quantity <= 1 ? 'trash-outline' : 'remove'} size={16} color={colors.textInverse} />
    </TouchableOpacity>
    <Text style={styles.stepperValue}>{quantity}</Text>
    <TouchableOpacity onPress={onIncrement} disabled={disabled} style={styles.stepperBtn} accessibilityLabel="Increase quantity" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Ionicons name="add" size={16} color={colors.textInverse} />
    </TouchableOpacity>
  </View>
);

/** Compact "ADD" button that turns into a stepper once the item is in the cart */
export const AddToCartButton: React.FC<{
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}> = ({ quantity, onAdd, onIncrement, onDecrement, disabled }) =>
  quantity > 0 ? (
    <QuantityStepper quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} disabled={disabled} size="sm" />
  ) : (
    <TouchableOpacity
      onPress={onAdd}
      disabled={disabled}
      style={[styles.addButton, disabled && styles.addButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={disabled ? 'Unavailable' : 'Add to cart'}
    >
      <Text style={[styles.addButtonText, disabled && { color: colors.textTertiary }]}>{disabled ? 'UNAVAILABLE' : 'ADD'}</Text>
      {!disabled ? <Ionicons name="add" size={14} color={colors.primaryInk} /> : null}
    </TouchableOpacity>
  );

// ─── Layout helpers ───────────────────────────────────────────────────

/** Bottom action bar that respects the home indicator */
export const StickyFooter: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const insets = useSafeAreaInsets();
  return <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }, style]}>{children}</View>;
};

export const BottomSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  maxHeight?: ViewStyle['maxHeight'];
}> = ({ visible, onClose, title, subtitle, children, footer, scrollable = true, maxHeight = '88%' }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight, paddingBottom: footer ? 0 : Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHandle} />
          {title ? (
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={type.title}>{title}</Text>
                {subtitle ? <Text style={[type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
              </View>
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} variant="filled" size={20} />
            </View>
          ) : null}
          {scrollable ? (
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.sheetBody}>{children}</View>
          )}
          {footer ? <StickyFooter style={{ ...elevation.none, borderTopWidth: 0 }}>{footer}</StickyFooter> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centerText: { textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  loadingText: { ...type.small, color: colors.textSecondary },

  button: {
    height: sizes.buttonHeight,
    paddingHorizontal: spacing.xl,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonSm: { height: sizes.buttonHeightSm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  buttonTertiary: { paddingHorizontal: spacing.sm },
  buttonText: { ...type.button },
  buttonTextSm: { fontSize: 13, lineHeight: 18 },

  iconButton: { width: sizes.iconButton, height: sizes.iconButton, borderRadius: sizes.iconButton / 2, alignItems: 'center', justifyContent: 'center' },
  iconButtonFilled: { backgroundColor: colors.surface, width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  iconBadge: {
    position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.canvas,
  },
  iconBadgeText: { color: colors.textInverse, fontSize: 10, fontFamily: fonts.heavy },

  inputContainer: { marginBottom: spacing.lg },
  inputLabel: { ...type.label, marginBottom: spacing.xs + 2 },
  inputWrapper: {
    minHeight: sizes.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
  },
  inputWrapperMultiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  inputFocused: { borderColor: colors.text },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.surfaceMuted },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingVertical: 0 },
  inputMessageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs + 2 },
  errorText: { ...type.caption, color: colors.danger },
  helperText: { ...type.caption, marginTop: spacing.xs + 2 },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl },
  cardPadded: { padding: spacing.lg },
  cardOutlined: { borderWidth: 1, borderColor: colors.border },
  cardFlat: { backgroundColor: colors.surfaceMuted },
  cardSelected: { borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.surface },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bold },

  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.screen },
  chip: {
    height: 36, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...type.label, color: colors.text },
  chipTextSelected: { color: colors.textInverse },
  chipCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  chipCountSelected: { backgroundColor: colors.surface },
  chipCountText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },

  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: 14, padding: 4 },
  segment: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segmentActive: { backgroundColor: colors.surface, ...elevation.card },
  segmentText: { ...type.label, color: colors.textSecondary },
  segmentTextActive: { color: colors.text },

  screenHeader: {
    height: sizes.headerHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.screen, backgroundColor: colors.canvas,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md },
  sectionAction: { ...type.label, color: colors.primaryInk },

  listRow: { minHeight: sizes.listRow, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl + spacing.lg, paddingHorizontal: spacing.xxl },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2, padding: spacing.md + 2, borderRadius: 14 },

  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { ...type.label, color: colors.text },

  priceContainer: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  originalPrice: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },

  vegBox: { borderWidth: 1.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },

  stepper: {
    height: 36, minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primary, paddingHorizontal: 4,
  },
  stepperSm: { height: 32, minWidth: 88 },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { ...type.label, color: colors.textInverse, minWidth: 20, textAlign: 'center' },

  addButton: {
    height: 32, minWidth: 88, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
    borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, ...elevation.card,
  },
  addButtonDisabled: { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  addButtonText: { fontSize: 13, fontFamily: fonts.heavy, color: colors.primaryInk, letterSpacing: 0.6 },

  stickyFooter: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.screen, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },

  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { marginTop: 'auto', backgroundColor: colors.canvas, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  sheetBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
