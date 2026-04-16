import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { createQuestionnaire } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('错误', '请输入问卷标题');
      return;
    }

    setLoading(true);
    try {
      const questionnaire = await createQuestionnaire({
        title: title.trim(),
        description: description.trim(),
        deadline: deadline.toISOString(),
      });
      Alert.alert('成功', '问卷创建成功', [
        {
          text: '查看详情',
          onPress: () => router.replace(`/detail/${questionnaire.id}`),
        },
      ]);
    } catch (error) {
      console.error('Failed to create questionnaire:', error);
      Alert.alert('错误', '创建问卷失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDeadline = new Date(deadline);
      newDeadline.setFullYear(selectedDate.getFullYear());
      newDeadline.setMonth(selectedDate.getMonth());
      newDeadline.setDate(selectedDate.getDate());
      setDeadline(newDeadline);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDeadline = new Date(deadline);
      newDeadline.setHours(selectedTime.getHours());
      newDeadline.setMinutes(selectedTime.getMinutes());
      setDeadline(newDeadline);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#6C63FF', '#896BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>创建问卷</Text>
          <View style={styles.headerPlaceholder} />
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formSection}>
            <Text style={styles.label}>问卷标题</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="请输入问卷标题"
                placeholderTextColor="#B2BEC3"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>问卷描述</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="请输入问卷描述（可选）"
                placeholderTextColor="#B2BEC3"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>截止时间</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {formatDateTime(deadline)}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hint}>点击上方日期可修改截止时间</Text>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={deadline}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={deadline}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
            />
          )}

          <TouchableOpacity
            style={styles.createButtonContainer}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={loading ? ['#B2BEC3', '#B2BEC3'] : ['#6C63FF', '#896BFF']}
              style={styles.createButton}
            >
              <Text style={styles.createButtonText}>
                {loading ? '创建中...' : '创建问卷'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  input: {
    padding: 16,
    fontSize: 15,
    color: '#2D3436',
  },
  textAreaContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  textArea: {
    padding: 16,
    fontSize: 15,
    color: '#2D3436',
    minHeight: 100,
  },
  dateButton: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#2D3436',
  },
  hint: {
    fontSize: 12,
    color: '#B2BEC3',
    marginTop: 8,
  },
  createButtonContainer: {
    marginTop: 20,
  },
  createButton: {
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
