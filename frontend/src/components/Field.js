import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { KeyboardAwareScrollContext } from './KeyboardAwareScrollView';

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secure = false,
  error = '',
  hint = '',
  multiline = false,
  maxLength,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  editable = true,
  leftIcon = null,
  testID,
}) => {
  const [hidden, setHidden] = useState(secure);
  const handleFocus = useContext(KeyboardAwareScrollContext);
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, error ? styles.boxError : null]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          testID={testID}
          style={[styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.slate400}
          keyboardType={keyboardType}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={handleFocus || undefined}
          editable={editable}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.eye}>
            {hidden ? <Eye size={18} color={colors.slate400} /> : <EyeOff size={18} color={colors.slate400} />}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', color: colors.slate800, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  boxError: { borderColor: colors.rose },
  leftIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: colors.slate900, paddingVertical: 13, minHeight: 50 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  eye: { padding: 6 },
  error: { fontSize: 13, color: colors.rose, marginTop: 4 },
  hint: { fontSize: 13, color: colors.slate500, marginTop: 4 },
});
