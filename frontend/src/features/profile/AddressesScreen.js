import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useShowToast } from '../../store/toast';
import { getMyAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from '../../api/services';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { Loader, ErrorBanner, EmptyState } from '../../components/feedback';

const EMPTY = { label: 'Home', flatNo: '', society: '', landmark: '', city: '' };

const AddressesScreen = () => {
  const showToast = useShowToast();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getMyAddresses();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load addresses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving) return;
    if (!form.flatNo.trim() || !form.society.trim() || !form.city.trim()) {
      showToast('Flat, society and city are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAddress(editing, form);
        showToast('Address updated.', 'success');
      } else {
        await addAddress(form);
        showToast('Address saved.', 'success');
      }
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not save the address.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id) => {
    Alert.alert('Delete address?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddress(id);
            showToast('Address deleted.', 'info');
            await load();
          } catch (e) {
            showToast(e?.response?.data?.message || 'Could not delete.', 'error');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>Saved addresses</Text>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : rows.length === 0 && !editing ? (
          <EmptyState title="No saved addresses" message="Save your home address to book faster." />
        ) : (
          rows.map((a) => (
            <View key={a._id} style={shared.card}>
              <View style={shared.spread}>
                <Text style={shared.h3}>{a.label || 'Address'}{a.isDefault ? ' · Default' : ''}</Text>
              </View>
              <Text style={shared.small}>
                {[a.flatNo, a.society, a.landmark, a.city].filter(Boolean).join(', ')}
              </Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => {
                    setEditing(a._id);
                    setForm({ label: a.label || 'Home', flatNo: a.flatNo || '', society: a.society || '', landmark: a.landmark || '', city: a.city || '' });
                  }}>
                  <Text style={styles.link}>Edit</Text>
                </TouchableOpacity>
                {!a.isDefault ? (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await setDefaultAddress(a._id);
                        await load();
                      } catch (e) {
                        showToast('Could not set default.', 'error');
                      }
                    }}>
                    <Text style={styles.link}>Set default</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => remove(a._id)}>
                  <Text style={[styles.link, { color: colors.rose }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <Text style={[shared.h2, shared.mt8]}>{editing ? 'Edit address' : 'Add address'}</Text>
        <Field label="Label" value={form.label} onChangeText={set('label')} maxLength={40} />
        <Field label="Flat / house no. *" value={form.flatNo} onChangeText={set('flatNo')} maxLength={120} />
        <Field label="Society / building *" value={form.society} onChangeText={set('society')} maxLength={160} />
        <Field label="Landmark" value={form.landmark} onChangeText={set('landmark')} maxLength={160} />
        <Field label="City *" value={form.city} onChangeText={set('city')} maxLength={80} />
        <Button title={saving ? 'Saving…' : editing ? 'Update address' : 'Save address'} onPress={save} loading={saving} />
        {editing ? (
          <View style={shared.mt8}>
            <Button title="Cancel editing" variant="outline" onPress={() => { setEditing(null); setForm(EMPTY); }} />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

export default AddressesScreen;
