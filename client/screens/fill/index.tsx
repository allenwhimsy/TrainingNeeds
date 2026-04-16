import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { getQuestionnaire, submitSuggestion, Questionnaire } from '@/utils/api';

export default function FillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionnaireId = parseInt(id || '0');

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [content, setContent] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchQuestionnaire();
  }, [questionnaireId]);

  const fetchQuestionnaire = async () => {
    try {
      const data = await getQuestionnaire(questionnaireId);
      setQuestionnaire(data);

      // Check if deadline has passed
      if (new Date(data.deadline) < new Date()) {
        Alert.alert(
          '已截止',
          '该问卷的收集时间已截止，感谢您的关注！',
          [{ text: '确定', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Failed to fetch questionnaire:', error);
      Alert.alert('错误', '获取问卷信息失败', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('错误', '请输入您的意见');
      return;
    }

    setSubmitting(true);
    try {
      await submitSuggestion(questionnaireId, {
        content: content.trim(),
        submitterName: submitterName.trim() || '匿名用户',
      });
      setSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit:', error);
      Alert.alert('错误', error.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  if (!questionnaire) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>问卷不存在</Text>
        </View>
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen>
        <View style={styles.container}>
          <LinearGradient
            colors={['#6C63FF', '#896BFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>提交成功</Text>
          </LinearGradient>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>感谢您的反馈！</Text>
            <Text style={styles.successDescription}>
              您的意见已被成功提交，我们会认真参考您的建议来优化培训内容。
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6C63FF', '#896BFF']}
                style={styles.doneButtonGradient}
              >
                <Text style={styles.doneButtonText}>返回</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

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
          <Text style={styles.headerTitle}>填写意见</Text>
          <View style={styles.headerPlaceholder} />
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.questionnaireInfo}>
            <Text style={styles.questionnaireTitle}>{questionnaire.title}</Text>
            {questionnaire.description ? (
              <Text style={styles.questionnaireDescription}>
                {questionnaire.description}
              </Text>
            ) : null}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>您的姓名（选填）</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="请输入您的姓名"
                placeholderTextColor="#B2BEC3"
                value={submitterName}
                onChangeText={setSubmitterName}
                maxLength={50}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>您的意见建议 *</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="请输入您对培训的意见和建议，例如：&#10;• 希望增加更多实战案例&#10;• 希望培训时间安排在周末&#10;• 希望增加小组讨论环节"
                placeholderTextColor="#B2BEC3"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>
            <Text style={styles.charCount}>{content.length}/1000</Text>
          </View>

          <TouchableOpacity
            style={styles.submitButtonContainer}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                submitting ? ['#B2BEC3', '#B2BEC3'] : ['#6C63FF', '#896BFF']
              }
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? '提交中...' : '提交意见'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#636E72',
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
  questionnaireInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  questionnaireTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 8,
  },
  questionnaireDescription: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 22,
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
    minHeight: 160,
  },
  charCount: {
    fontSize: 12,
    color: '#B2BEC3',
    textAlign: 'right',
    marginTop: 8,
  },
  submitButtonContainer: {
    marginTop: 12,
  },
  submitButton: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 184, 148, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#00B894',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  doneButton: {
    width: '100%',
  },
  doneButtonGradient: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
