import React, { ChangeEvent, FormEvent, lazy, useEffect, useState } from 'react'
import { Box, Button, Card, CardBody, CardHeader, Flex, Heading, Input, LinkExternal, Text } from '@pancakeswap/uikit'
import { useWeb3React } from '@web3-react/core'
import times from 'lodash/times'
import useWeb3 from 'hooks/useWeb3'
import { useHistory } from 'react-router'
import { format, parseISO, isValid } from 'date-fns'
import { useInitialBlock } from 'state/hooks'
import { getBscScanAddressUrl, getBscScanBlockNumberUrl } from 'utils/bscscan'
import truncateWalletAddress from 'utils/truncateWalletAddress'
import { getCakeAddress } from 'utils/addressHelpers'
import { useTranslation } from 'contexts/Localization'
import Container from 'components/layout/Container'
import { DatePicker, TimePicker } from 'components/DatePicker'
import { PANCAKE_SPACE } from '../config'
import { createProposal, Message, saveVotingPower } from '../helpers'
import Layout from '../components/Layout'
import { Label, SecondaryLabel } from './styles'
import Choices, { Choice, makeChoice, MINIMUM_CHOICES } from './Choices'

interface State {
  name: string
  body: string
  choices: Choice[]
  startDate: Date
  startTime: Date
  endDate: Date
  endTime: Date
  snapshot: number
}

const SimpleMde = lazy(() => import('components/SimpleMde'))

const combineDateAndTime = (date: Date, time: Date) => {
  if (!isValid(date) || !isValid(time)) {
    return null
  }

  const dateStr = format(date, 'yyyy-MM-dd')
  const timeStr = format(time, 'HH:mm:ss')

  return parseISO(`${dateStr}T${timeStr}`).getTime() / 1e3
}

const CreateProposal = () => {
  const [state, setState] = useState<State>({
    name: 'PancakeSwap Expert Mode',
    body: 'A site for experts. Faster and more tools.',
    choices: times(MINIMUM_CHOICES).map(makeChoice),
    startDate: new Date(),
    startTime: null,
    endDate: null,
    endTime: null,
    snapshot: 0,
  })
  const { t } = useTranslation()
  const { account } = useWeb3React()
  const initialBlock = useInitialBlock()
  const { push } = useHistory()
  const web3 = useWeb3()
  const { name, body, choices, startDate, startTime, endDate, endTime, snapshot } = state

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault()

    try {
      const proposal = JSON.stringify({
        version: '0.1.3',
        timestamp: (Date.now() / 1e3).toFixed(),
        space: PANCAKE_SPACE,
        type: 'proposal',
        payload: {
          name,
          body,
          snapshot,
          start: combineDateAndTime(startDate, startTime),
          end: combineDateAndTime(endDate, endTime),
          choices: choices.map((choice) => {
            return choice.value
          }),
          metadata: { strategies: [{ name: PANCAKE_SPACE, params: { address: getCakeAddress(), chefAddresses: [] } }] },
        },
      })
      const sig = await web3.eth.personal.sign(proposal, account, null)
      const msg: Message = { address: account, msg: proposal, sig }

      // Save proposal to snapshot
      const data = await createProposal(msg)

      // Cache the voting power
      await saveVotingPower(account, data.ipfsHash, 1)

      // Redirect user to newly created proposal page
      push(`/voting/proposal/${data.ipfsHash}`)
    } catch (error) {
      console.error(error)
    }
  }

  const updateValue = (key: string, value: string | Choice[] | Date) => {
    setState((prevState) => ({
      ...prevState,
      [key]: value,
    }))
  }

  const handleChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const { name: inputName, value } = evt.currentTarget
    updateValue(inputName, value)
  }

  const handleSimpleMdeChange = (value: string) => {
    updateValue('body', value)
  }

  const handleChoiceChange = (newChoices: Choice[]) => {
    updateValue('choices', newChoices)
  }

  const handleDateChange = (key: string) => (value: Date) => {
    updateValue(key, value)
  }

  useEffect(() => {
    if (initialBlock > 0) {
      setState((prevState) => ({
        ...prevState,
        snapshot: initialBlock,
      }))
    }
  }, [initialBlock, setState])

  return (
    <Container py="40px">
      <form onSubmit={handleSubmit}>
        <Layout>
          <Box>
            <Box mb="24px">
              <Label htmlFor="name">{t('Title')}</Label>
              <Input id="name" name="name" value={name} scale="lg" onChange={handleChange} required />
            </Box>
            <Box mb="24px">
              <Label htmlFor="body">{t('Content')}</Label>
              <Text color="textSubtle" mb="8px">
                {t('Tip: write in Markdown!')}
              </Text>
              <SimpleMde id="body" name="body" onTextChange={handleSimpleMdeChange} value={body} required />
            </Box>
            <Choices choices={choices} onChange={handleChoiceChange} />
          </Box>
          <Box>
            <Card>
              <CardHeader>
                <Heading as="h3" scale="md">
                  {t('Actions')}
                </Heading>
              </CardHeader>
              <CardBody>
                <Box mb="24px">
                  <SecondaryLabel>{t('Start Date')}</SecondaryLabel>
                  <DatePicker name="startDate" onChange={handleDateChange('startDate')} selected={startDate} />
                </Box>
                <Box mb="24px">
                  <SecondaryLabel>{t('Start Time')}</SecondaryLabel>
                  <TimePicker name="startTime" onChange={handleDateChange('startTime')} selected={startTime} />
                </Box>
                <Box mb="24px">
                  <SecondaryLabel>{t('End Date')}</SecondaryLabel>
                  <DatePicker name="endDate" onChange={handleDateChange('endDate')} selected={endDate} />
                </Box>
                <Box mb="24px">
                  <SecondaryLabel>{t('End Time')}</SecondaryLabel>
                  <TimePicker name="endTime" onChange={handleDateChange('endTime')} selected={endTime} />
                </Box>
                {account && (
                  <Flex alignItems="center" mb="8px">
                    <Text color="textSubtle" mr="16px">
                      {t('Creator')}
                    </Text>
                    <LinkExternal href={getBscScanAddressUrl(account)}>{truncateWalletAddress(account)}</LinkExternal>
                  </Flex>
                )}
                <Flex alignItems="center" mb="16px">
                  <Text color="textSubtle" mr="16px">
                    {t('Snapshot')}
                  </Text>
                  <LinkExternal href={getBscScanBlockNumberUrl(snapshot)}>{snapshot}</LinkExternal>
                </Flex>
                <Button type="submit" width="100%">
                  {t('Publish')}
                </Button>
              </CardBody>
            </Card>
          </Box>
        </Layout>
      </form>
    </Container>
  )
}

export default CreateProposal