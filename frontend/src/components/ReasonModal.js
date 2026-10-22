import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { shared } from '../theme/shared';
import { Button } from './Button';

// Shared bottom-sheet picker for cancellation/refund/complaint/no-show flows.
// Keeping the option list and note in one component means every destructive
// action collects the same structured reason the backend audits.
const ReasonModal = ({
  visible,
  title,
  subtitle,
  options = [],
  value,
  onChange,
  note = '',
  onNoteChange,
  noteRequired = false,
  noteMinLength = 0,
  noteMaxLength = 500,
  noteLabel = 'Additional details (optional)',
  notePlaceholder = 'Tell us briefly what happened…',
  showNote = true,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  onClose,
  busy = false,
  error = '',
  children = null,
}) => {
  const selectedOption = options.find((o) => o.value === value);
  const noteRequiredNow = noteRequired || (selectedOption && selectedOption.value === 'OTHER');
  const noteTooShort = noteRequiredNow && note.trim().length < Math.max(1, noteMinLength);
  const disabled = busy || (options.length > 0 && !value) || noteTooShort;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.overlay} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={shared.h2}>{title}</Text>
              {subtitle ? <Text style={[shared.small, shared.mt8]}>{subtitle}</Text> : null}

              {children}

              {options.length ? (
                <View style={styles.options}>
                  {options.map((option) => {
                    const active = option.value === value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={[styles.option, active && styles.optionOn]}
                        onPress={() => onChange?.(option.value)}>
                        <View style={[styles.radio, active && styles.radioOn]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                        <Text style={[styles.optionText, active && styles.optionTextOn]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {showNote ? (
                <>
                  <Text style={styles.noteLabel}>
                    {noteRequiredNow ? noteLabel.replace('(optional)', '(required)') : noteLabel}
                  </Text>
                  <TextInput
                    style={styles.note}
                    value={note}
                    onChangeText={onNoteChange}
                    multiline
                    maxLength={noteMaxLength}
                    placeholder={notePlaceholder}
                    placeholderTextColor={colors.slate400}
                    textAlignVertical="top"
                  />
                  <Text style={styles.counter}>
                    {note.trim().length}/{noteMaxLength}
                  </Text>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.actions}>
                <View style={shared.flex1}>
                  <Button title="Close" variant="outline" onPress={onClose} disabled={busy} />
                </View>
                <View style={shared.flex1}>
                  <Button
                    title={busy ? 'Please wait…' : confirmLabel}
                    variant={confirmVariant}
                    onPress={onConfirm}
                    loading={busy}
                    disabled={disabled}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.48)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.slate200,
    marginBottom: 4,
  },
  content: { padding: 18, paddingTop: 8, gap: 8 },
  options: { gap: 8, marginTop: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.white,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.slate700 },
  optionTextOn: { color: colors.primary800, fontWeight: '700' },
  noteLabel: { fontSize: 13, fontWeight: '700', color: colors.slate700, marginTop: 8 },
  note: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.white,
  },
  counter: { fontSize: 11, color: colors.slate400, textAlign: 'right' },
  error: { fontSize: 13, fontWeight: '600', color: colors.rose, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
});

export default ReasonModal;
